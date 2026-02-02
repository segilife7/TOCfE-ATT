
import React, { useState, useMemo, useRef } from 'react';
import { 
  TreeData, 
  AppStep, 
  Obstacle, 
  IntermediateObjective, 
  ActionPlan 
} from './types';
import * as geminiService from './services/geminiService';
import StepIndicator from './components/StepIndicator';
import AIButton from './components/AIButton';
import TreeVisualizer from './components/TreeVisualizer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.TARGET);
  const [isSaving, setIsSaving] = useState(false);
  
  // 섹션별 캡처를 위한 Ref 추가
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const finalCardRef = useRef<HTMLDivElement>(null); // 전체 이미지 저장용

  const [data, setData] = useState<TreeData>({
    target: "",
    obstacles: [],
    ios: [],
    actions: []
  });

  const [targetDraft, setTargetDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIoId, setActiveIoId] = useState<string | null>(null);

  const sortedIos = useMemo(() => {
    const sorted: IntermediateObjective[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visiting.has(id)) return; 
      if (visited.has(id)) return;

      visiting.add(id);
      const io = data.ios.find(i => i.id === id);
      if (io) {
        io.prerequisites.forEach(pId => visit(pId));
        sorted.push(io);
      }
      visiting.delete(id);
      visited.add(id);
    };

    data.ios.forEach(io => visit(io.id));
    return sorted;
  }, [data.ios]);

  const handleSuggestTarget = async () => {
    if (!targetDraft.trim()) {
      alert("먼저 목표 초안을 입력해주세요.");
      return;
    }
    const res = await geminiService.suggestTarget(targetDraft);
    setSuggestions(res);
  };

  const selectTarget = (t: string) => {
    setData(prev => ({ ...prev, target: t }));
    setTargetDraft(t);
  };

  const addObstacle = (text?: string) => {
    const obstacleText = text || "";
    if (!obstacleText.trim()) return;
    setData(prev => ({
      ...prev,
      obstacles: [...prev.obstacles, { id: crypto.randomUUID(), text: obstacleText }]
    }));
  };

  const handleSuggestObstacles = async () => {
    const res = await geminiService.suggestObstacles(data.target);
    res.forEach((obs: string) => addObstacle(obs));
  };

  const removeObstacle = (id: string) => {
    setData(prev => ({
      ...prev,
      obstacles: prev.obstacles.filter(o => o.id !== id),
      ios: prev.ios.filter(io => io.obstacleId !== id)
    }));
  };

  const handleSuggestIOs = async () => {
    const obsTexts = data.obstacles.map(o => o.text);
    const res = await geminiService.suggestIOs(obsTexts);
    
    const newIos: IntermediateObjective[] = res.map((m: any) => {
      const obstacle = data.obstacles.find(o => o.text === m.obstacle);
      return {
        id: crypto.randomUUID(),
        obstacleId: obstacle?.id || "",
        text: m.io,
        type: 'condition',
        prerequisites: []
      };
    });
    setData(prev => ({ ...prev, ios: newIos }));
  };

  const updateIO = (obstacleId: string, text: string) => {
    setData(prev => {
      const existing = prev.ios.find(io => io.obstacleId === obstacleId);
      if (existing) {
        return {
          ...prev,
          ios: prev.ios.map(io => io.obstacleId === obstacleId ? { ...io, text } : io)
        };
      } else {
        return {
          ...prev,
          ios: [...prev.ios, { id: crypto.randomUUID(), obstacleId, text, type: 'condition', prerequisites: [] }]
        };
      }
    });
  };

  const handleSuggestSequence = async () => {
    const ioPairs = data.ios.map(io => ({ id: io.id, text: io.text }));
    const res = await geminiService.suggestSequence(ioPairs);
    setData(prev => ({
      ...prev,
      ios: prev.ios.map(io => {
        const dep = res.find((d: any) => d.id === io.id);
        return dep ? { ...io, prerequisites: dep.prerequisiteIds } : io;
      })
    }));
  };

  const togglePrerequisite = (ioId: string, preId: string) => {
    setData(prev => ({
      ...prev,
      ios: prev.ios.map(io => {
        if (io.id === ioId) {
          const isPre = io.prerequisites.includes(preId);
          return {
            ...io,
            prerequisites: isPre ? io.prerequisites.filter(id => id !== preId) : [...io.prerequisites, preId]
          };
        }
        return io;
      })
    }));
  };

  const addAction = (ioId: string, task: string) => {
    if (!task.trim()) return;
    setData(prev => ({
      ...prev,
      actions: [...prev.actions, { id: crypto.randomUUID(), ioId, task, who: '나', when: '기한 입력' }]
    }));
  };

  const updateAction = (id: string, field: keyof ActionPlan, value: string) => {
    setData(prev => ({
      ...prev,
      actions: prev.actions.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const handleSuggestActionPlan = async (io: IntermediateObjective) => {
    const res = await geminiService.suggestActionPlan(io.text);
    res.forEach((task: string) => addAction(io.id, task));
  };

  // PDF 저장 로직 (멀티 페이지 지원)
  const handleSavePDF = async () => {
    if (!page1Ref.current || !page2Ref.current || isSaving) return;
    setIsSaving(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // 1페이지 캡처 (목표 + 트리)
      const canvas1 = await html2canvas(page1Ref.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.95);
      const imgProps1 = pdf.getImageProperties(imgData1);
      const ratio1 = (imgProps1.height * pdfWidth) / imgProps1.width;
      pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, Math.min(ratio1, pdfHeight));

      // 2페이지 추가
      pdf.addPage();
      
      // 2페이지 캡처 (실행 마스터 플랜)
      const canvas2 = await html2canvas(page2Ref.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.95);
      const imgProps2 = pdf.getImageProperties(imgData2);
      const ratio2 = (imgProps2.height * pdfWidth) / imgProps2.width;
      pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, Math.min(ratio2, pdfHeight));

      pdf.save(`TOCfE_Plan_${data.target.substring(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF 저장 실패:", error);
      alert("PDF 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveImage = async () => {
    if (!finalCardRef.current || isSaving) return;
    setIsSaving(true);
    try {
      const element = finalCardRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement('a');
      link.download = `TOCfE_Plan_${data.target.substring(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("이미지 저장 실패:", error);
      alert("이미지 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-10 bg-[#fbfbf9]">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1e293b] rounded-lg flex items-center justify-center text-white shadow-md">
              <i className="fa-solid fa-seedling text-lg"></i>
            </div>
            <h1 className="font-black text-xl text-stone-800 tracking-tight">Target Tree Builder <span className="text-emerald-600 text-[10px] font-black bg-emerald-50 px-2 py-0.5 rounded-full ml-1">TOCfE</span></h1>
          </div>
          <div className="flex gap-2">
            {step > 1 && step < 6 && (
              <button onClick={() => setStep(prev => prev - 1)} className="px-4 py-2 text-stone-500 hover:text-stone-900 font-bold transition-all text-sm rounded-lg hover:bg-stone-100">
                <i className="fa-solid fa-chevron-left mr-2"></i> 이전
              </button>
            )}
            {step < 5 && (
              <button 
                onClick={() => setStep(prev => prev + 1)} 
                disabled={step === 1 && !data.target}
                className="px-6 py-2 bg-[#1e293b] hover:bg-stone-900 text-white rounded-lg font-black shadow-lg transition-all active:scale-95 disabled:opacity-20 text-sm"
              >
                다음 단계 <i className="fa-solid fa-chevron-right ml-2"></i>
              </button>
            )}
            {step === 5 && (
              <button onClick={() => setStep(6)} className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-black shadow-lg text-sm transition-all active:scale-95">
                최종 확인 <i className="fa-solid fa-wand-magic-sparkles ml-2"></i>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-6 py-10 ${step === AppStep.SEQUENCE ? 'h-[calc(100vh-160px)]' : ''}`}>
        {step < 6 && step !== AppStep.SEQUENCE && (
          <div className="mb-12 no-print">
            <StepIndicator currentStep={step} />
            {data.target && step > 1 && (
              <div className="max-w-4xl mx-auto mt-8">
                <div className="bg-[#f3f4f1] border border-stone-200 rounded-2xl px-6 py-4 flex items-center gap-5 shadow-sm">
                  <div className="shrink-0 px-3 py-1 bg-stone-800 text-white text-[9px] font-black rounded-md uppercase">Target</div>
                  <p className="text-stone-900 font-black text-base italic leading-tight">"{data.target}"</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: TARGET SETTING */}
        {step === AppStep.TARGET && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-700">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-stone-200 rounded-[2rem] p-8 shadow-sm">
                <h3 className="text-lg font-black text-stone-900 mb-6 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-500"></i> 목표 수립 가이드
                </h3>
                <ul className="space-y-5">
                  <li className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black">1</span>
                    <p className="text-sm font-bold text-stone-600 leading-tight">구체적이고 명확한가?</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black">2</span>
                    <p className="text-sm font-bold text-stone-600 leading-tight">달성 여부 측정이 가능한가?</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black">3</span>
                    <p className="text-sm font-bold text-stone-600 leading-tight">도전적이며 달성 가능한가?</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black">4</span>
                    <p className="text-sm font-bold text-stone-600 leading-tight">현실적인 목표인가?</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-black">5</span>
                    <p className="text-sm font-bold text-stone-600 leading-tight">구체적인 기한이 명시되었는가?</p>
                  </li>
                </ul>
                <div className="mt-8 p-5 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-2">중요 알림</p>
                  <p className="text-xs font-bold text-amber-800 leading-relaxed italic">
                    "목표에는 **방법(How)**이 들어가면 안 됩니다. 오직 **간절히 바라는 결과 상태**에만 집중하세요."
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-10">
              <div className="bg-white border border-stone-200 rounded-[2.5rem] p-12 shadow-sm">
                <h2 className="text-3xl font-black text-stone-900 mb-2">Step 1. 야심찬 목표 설정</h2>
                <p className="text-stone-500 mb-10 font-medium">원하는 결과와 기한이 포함된 완전한 문장으로 작성하세요.</p>
                
                <div className="flex flex-col gap-8">
                  <div className="relative">
                    <textarea 
                      value={targetDraft}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      placeholder="초안 입력... (예: 12월 31일까지 체중 10kg을 감량하고 건강을 유지한다)"
                      className="w-full p-10 text-2xl border-2 border-stone-100 bg-stone-50/50 rounded-3xl focus:border-emerald-600 focus:bg-white transition-all h-56 leading-tight font-black shadow-inner"
                    />
                  </div>

                  <div className="flex gap-4 items-center">
                    <AIButton onClick={handleSuggestTarget} label="AI 목표 다듬기" icon="fa-wand-sparkles" />
                    <button onClick={() => selectTarget(targetDraft)} className="px-10 py-3 bg-stone-900 text-white rounded-xl font-black text-sm hover:bg-black transition-colors shadow-lg shadow-stone-200">이 문장으로 결정</button>
                  </div>

                  {suggestions.length > 0 && (
                    <div className="mt-4 animate-in slide-in-from-top-4 duration-500 bg-emerald-50/30 p-8 rounded-[2rem] border border-emerald-100">
                      <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <i className="fa-solid fa-sparkles text-emerald-500"></i> AI 추천 문장 (방법 제외, 상태+기한 집중)
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {suggestions.map((s, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => setTargetDraft(s)}
                            className="text-left p-6 bg-white border-2 border-emerald-50 rounded-2xl hover:border-emerald-600 hover:shadow-xl hover:-translate-y-1 transition-all group shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-2">
                               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">추천 버전 {idx + 1}</span>
                               <i className="fa-solid fa-check-circle text-emerald-100 group-hover:text-emerald-500 transition-colors"></i>
                            </div>
                            <p className="font-bold text-stone-800 text-lg leading-snug">{s}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2~5 생략 (기존 코드 유지) */}
        {step === AppStep.OBSTACLES && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-500">
             <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-stone-900">Step 2. 장애(Obstacles) 발견</h2>
                <p className="text-stone-500 font-medium">목표를 가로막는 부정적인 상태를 '~다' 형태의 문장으로 나열하세요.</p>
              </div>
              <AIButton onClick={handleSuggestObstacles} label="장애물 자동 분석" icon="fa-magnifying-glass-chart" />
            </div>
            <div className="bg-white border border-stone-200 rounded-[2rem] p-10 shadow-sm">
              <div className="flex gap-3 mb-8">
                <input type="text" id="newObsInput" placeholder="새로운 장애물 입력" className="flex-grow p-4 bg-stone-50 border-2 border-stone-100 rounded-2xl font-bold focus:border-stone-800 transition-all outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { addObstacle((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                <button onClick={() => { const input = document.getElementById('newObsInput') as HTMLInputElement; addObstacle(input.value); input.value = ''; }} className="px-10 py-2 bg-stone-900 text-white rounded-2xl font-black shadow-lg">추가</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.obstacles.map(obs => (
                  <div key={obs.id} className="group bg-stone-50 p-6 rounded-2xl border border-stone-100 flex items-start justify-between hover:bg-white transition-all shadow-sm">
                    <p className="text-stone-800 font-bold leading-relaxed">{obs.text}</p>
                    <button onClick={() => removeObstacle(obs.id)} className="text-stone-300 hover:text-red-500 p-2 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === AppStep.IOS && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-500">
             <div className="flex justify-between items-end">
              <h2 className="text-2xl font-black text-stone-900">Step 3. 중간목표(IO) 전환</h2>
              <AIButton onClick={handleSuggestIOs} label="IO 긍정문으로 변환" icon="fa-arrows-rotate" />
            </div>
            <div className="space-y-6">
              {data.obstacles.map(obs => {
                const io = data.ios.find(i => i.obstacleId === obs.id);
                return (
                  <div key={obs.id} className="bg-white border border-stone-200 rounded-3xl p-8 flex flex-col md:flex-row gap-8 shadow-sm group hover:shadow-md transition-shadow">
                    <div className="md:w-1/2">
                       <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded mb-3">OBSTACLE</span>
                       <p className="font-bold text-stone-400 text-lg leading-relaxed">{obs.text}</p>
                    </div>
                    <div className="md:w-1/2 border-l-2 border-stone-50 md:pl-8">
                       <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded mb-3">INTERMEDIATE OBJECTIVE</span>
                       <input type="text" value={io?.text || ""} onChange={(e) => updateIO(obs.id, e.target.value)} placeholder="중간목표를 입력하세요" className="w-full bg-transparent border-b-4 border-stone-100 focus:border-emerald-500 outline-none font-black text-xl py-2 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === AppStep.SEQUENCE && (
          <div className="flex gap-8 h-full animate-in slide-in-from-bottom-8 duration-500">
             <div className="w-1/3 flex flex-col bg-white border border-stone-200 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
               <h2 className="text-2xl font-black mb-2 text-stone-900">Step 4. 순서 정하기</h2>
               <p className="text-stone-400 text-sm mb-6 font-medium">목표 간의 '선행 조건' 논리를 정의하세요.</p>
               <AIButton onClick={handleSuggestSequence} label="AI 자동 논리 배치" icon="fa-brain-circuit" />
               <div className="flex-grow overflow-y-auto mt-8 space-y-4 pr-2">
                 {data.ios.map(io => (
                   <div key={io.id} onMouseEnter={() => setActiveIoId(io.id)} onMouseLeave={() => setActiveIoId(null)} className={`p-5 rounded-2xl border-2 transition-all duration-300 ${activeIoId === io.id ? 'bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-100' : 'bg-stone-50 border-stone-100'}`}>
                     <p className="font-bold text-sm mb-4 text-stone-800">{io.text}</p>
                     <div className="flex flex-wrap gap-2">
                       {data.ios.filter(other => other.id !== io.id).map(other => (
                         <button key={other.id} onClick={() => togglePrerequisite(io.id, other.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${io.prerequisites.includes(other.id) ? "bg-stone-900 text-white shadow-md" : "bg-white border text-stone-400 hover:border-emerald-500 hover:text-emerald-700"}`}>{other.text.substring(0, 12)}...</button>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
             <div className="w-2/3"><TreeVisualizer data={data} activeIoId={activeIoId} /></div>
          </div>
        )}

        {step === AppStep.ACTION_PLAN && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-stone-900">Step 5. 행동 계획(Action Plan)</h2>
                <p className="text-stone-500 font-medium">논리적 순서에 따라 구체적인 실행 방안을 확정하세요.</p>
              </div>
            </div>
            <div className="space-y-12">
              {sortedIos.map((io, idx) => (
                <div key={io.id} className="bg-white border border-stone-200 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-6 bg-stone-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="bg-emerald-600 text-[10px] px-3 py-1 rounded-full font-black shadow-inner">SEQUENCE {idx + 1}</span>
                      <h3 className="font-black text-lg">{io.text}</h3>
                    </div>
                    <AIButton onClick={() => handleSuggestActionPlan(io)} label="실행 제안" icon="fa-bolt-lightning" />
                  </div>
                  <div className="p-8">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left border-b-2 border-stone-50 text-stone-400 font-black text-[11px] uppercase tracking-widest">
                          <th className="pb-4 px-2 w-7/12">주요 활동</th>
                          <th className="pb-4 px-2 w-2/12">담당자</th>
                          <th className="pb-4 px-2 w-2/12">일시/기한</th>
                          <th className="pb-4 w-1/12 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {data.actions.filter(a => a.ioId === io.id).map(action => (
                          <tr key={action.id} className="group hover:bg-stone-50/50">
                            <td className="py-4 px-1"><input type="text" value={action.task} onChange={(e) => updateAction(action.id, 'task', e.target.value)} className="w-full p-2 bg-transparent focus:bg-white border-2 border-transparent focus:border-emerald-100 rounded-xl font-bold text-stone-800 outline-none transition-all" /></td>
                            <td className="py-4 px-1"><input type="text" value={action.who} onChange={(e) => updateAction(action.id, 'who', e.target.value)} className="w-full p-2 bg-stone-50/50 rounded-xl text-xs font-black outline-none border-2 border-transparent focus:border-emerald-100 transition-all" /></td>
                            <td className="py-4 px-1"><input type="text" value={action.when} onChange={(e) => updateAction(action.id, 'when', e.target.value)} className="w-full p-2 bg-stone-50/50 rounded-xl text-xs font-black outline-none border-2 border-transparent focus:border-emerald-100 transition-all" /></td>
                            <td className="py-4 text-center"><button onClick={() => setData(prev => ({ ...prev, actions: prev.actions.filter(a => a.id !== action.id) }))} className="text-stone-200 hover:text-red-500 transition-colors p-2"><i className="fa-solid fa-xmark"></i></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-6">
                        <input type="text" placeholder="새로운 실행 과제 입력" className="w-full p-5 bg-stone-50 border-2 border-stone-100 rounded-2xl text-sm font-bold outline-none focus:border-stone-800 transition-all shadow-inner" onKeyDown={(e) => { if (e.key === 'Enter') { addAction(io.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: FINAL VIEW */}
        {step === AppStep.FINAL_VIEW && (
          <div className="animate-in zoom-in-95 duration-700 max-w-7xl mx-auto pb-24 space-y-8">
            {/* Control Panel */}
            <div className="no-print bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs"><i className="fa-solid fa-download"></i></div>
                 <span className="font-black text-stone-700">전략 로드맵을 저장하세요</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleSavePDF} 
                  disabled={isSaving}
                  className="px-6 py-3 bg-stone-900 text-white rounded-xl font-black flex items-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg disabled:opacity-50 text-sm"
                >
                  {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-pdf"></i>}
                  PDF 저장
                </button>
                <button 
                  onClick={handleSaveImage} 
                  disabled={isSaving}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg disabled:opacity-50 text-sm"
                >
                  {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-image"></i>}
                  이미지 저장
                </button>
                <button onClick={() => setStep(AppStep.TARGET)} className="px-6 py-3 bg-stone-100 border text-stone-600 rounded-xl font-black hover:bg-stone-200 transition-all text-sm">
                   <i className="fa-solid fa-rotate-left mr-2"></i> 다시 시작
                </button>
              </div>
            </div>

            {/* Document Export Wrapper (Entire Document Image Capture용) */}
            <div ref={finalCardRef} className="final-document-container space-y-8 bg-[#fbfbf9]">
              
              {/* PAGE 1: Target & Diagram */}
              <div ref={page1Ref} className="bg-white p-16 rounded-[2.5rem] shadow-2xl border border-stone-100">
                <div className="mb-12 border-b-8 border-stone-900 pb-10">
                  <div className="inline-flex px-3 py-1 bg-emerald-700 text-white text-[9px] font-black rounded-full uppercase tracking-widest mb-4">TOCfE Strategic Roadmap</div>
                  <h1 className="text-3xl font-black text-stone-900 leading-tight tracking-tight max-w-4xl">{data.target}</h1>
                </div>

                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 bg-stone-900 rounded-lg flex items-center justify-center text-white text-sm shadow-md"><i className="fa-solid fa-diagram-project"></i></div>
                    <h3 className="text-lg font-black text-stone-900">전략적 사고 체계 (Ambitious Target Tree)</h3>
                  </div>
                  <div className="h-[650px] border-[4px] border-stone-200 rounded-[2.5rem] bg-stone-50 overflow-hidden shadow-inner">
                    <TreeVisualizer data={data} />
                  </div>
                </section>
                
                <footer className="mt-16 pt-6 border-t border-stone-100 text-stone-300 font-black tracking-widest uppercase text-[9px] text-right">
                  Page 1 of 2
                </footer>
              </div>

              {/* PAGE 2: Execution Plan Table */}
              <div ref={page2Ref} className="bg-white p-16 rounded-[2.5rem] shadow-2xl border border-stone-100 min-h-[1000px]">
                {/* Header (Repeated for clarity on 2nd page) */}
                <div className="mb-10 border-b-2 border-stone-100 pb-6">
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Target Recap</span>
                  <p className="font-bold text-stone-600 italic text-sm mt-1">"{data.target}"</p>
                </div>

                <section>
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-sm shadow-md"><i className="fa-solid fa-list-check"></i></div>
                     <h3 className="text-lg font-black text-stone-900">실행 마스터 플랜 (Execution Master Plan)</h3>
                  </div>
                  
                  <div className="overflow-hidden rounded-xl border-[4px] border-black bg-black">
                    <table className="logic-table w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-[#fef9c3]">
                          <th className="border-2 border-black p-3 text-center w-12 font-black text-xs">No</th>
                          <th className="border-2 border-black p-3 text-left w-1/4 font-black text-xs">중간목표 (IO)</th>
                          <th className="border-2 border-black p-3 text-left font-black text-xs">상세 활동 계획 (Action Items)</th>
                          <th className="border-2 border-black p-3 text-center w-20 font-black text-xs">담당</th>
                          <th className="border-2 border-black p-3 text-center w-28 font-black text-xs">기한</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedIos.map((io, idx) => {
                          const actions = data.actions.filter(a => a.ioId === io.id);
                          const rowCount = Math.max(actions.length, 1);
                          return actions.length > 0 ? (
                            actions.map((action, actionIdx) => (
                              <tr key={action.id} className="bg-white hover:bg-stone-50 transition-colors">
                                {actionIdx === 0 && (
                                  <>
                                    <td rowSpan={rowCount} className="border-2 border-black p-3 text-center font-black text-base bg-stone-50/50">{idx + 1}</td>
                                    <td rowSpan={rowCount} className="border-2 border-black p-4 font-black text-stone-900 leading-snug bg-white text-sm min-w-[180px]">{io.text}</td>
                                  </>
                                )}
                                <td className="border-2 border-black p-3 text-stone-700 font-bold text-xs leading-relaxed">
                                  <span className="inline-block mr-1 text-stone-300">•</span> {action.task}
                                </td>
                                <td className="border-2 border-black p-3 text-center text-[11px] font-black text-stone-500">{action.who}</td>
                                <td className="border-2 border-black p-3 text-center text-[11px] font-black text-emerald-700">{action.when}</td>
                              </tr>
                            ))
                          ) : (
                            <tr key={io.id} className="bg-white">
                              <td className="border-2 border-black p-3 text-center font-black bg-stone-50/50">{idx + 1}</td>
                              <td className="border-2 border-black p-4 font-black text-stone-900 leading-snug text-sm">{io.text}</td>
                              <td colSpan={3} className="border-2 border-black p-3 text-stone-300 italic text-xs">계획된 활동이 없습니다.</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                
                <footer className="mt-16 pt-6 border-t border-stone-100 text-stone-300 font-black tracking-widest uppercase text-[9px] text-right">
                  Page 2 of 2
                </footer>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-8 right-8 no-print fixed-controls">
         <div className="bg-stone-900 text-white px-6 py-4 rounded-[1.5rem] shadow-2xl border border-stone-800 flex items-center gap-4 transition-transform hover:scale-105">
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute inset-0 opacity-50"></div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full relative shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
            </div>
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-emerald-400">Thinking Mode: Active</span>
         </div>
      </div>
    </div>
  );
};

export default App;
