
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const suggestTarget = async (initialDraft: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `TOCfE(Thinking Process) 전문가로서 사용자의 목표 초안("${initialDraft}")을 '야심찬 목표(Ambitious Target)'로 다듬어주세요. 
    
    [핵심 작성 규칙 - 필수]:
    1. **방법(How-to) 배제**: "~를 하여", "~를 통해"와 같은 수단이나 방법은 절대 포함하지 마세요. 오직 '원하는 최종 상태'만 기술합니다.
    2. **기한 포함**: 반드시 구체적인 날짜나 기간이 포함되어야 합니다.
    3. **완결된 문장**: 반드시 "나는 [언제]까지 [상태]를 달성한다(완료한다/확보한다/성취한다)." 형태여야 합니다.
    4. **부수적 문장 금지**: 목표 문장 외에 설명이나 군더더기 문장은 넣지 마세요.
    
    [품질 가이드라인]:
    - 구체적이고 명확한가?
    - 목표를 달성했음이 측정 가능한가?
    - 달성 가능한가? (도전적이지만 불가능은 아님)
    - 현실적인가?
    - 기한이 명시되어 있는가?
    
    [제안할 3가지 버전]:
    - 버전 1: 기한과 수치가 결합된 가장 표준적인 야심찬 목표
    - 버전 2: 성취의 품질과 상태가 더 강조된 목표 (기한 포함)
    - 버전 3: 도전적 한계를 돌파하는 강력한 결과 중심 목표 (기한 포함)
    
    반드시 한국어로 JSON 형식으로 응답하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["suggestions"]
      }
    }
  });
  return JSON.parse(response.text).suggestions;
};

export const suggestObstacles = async (target: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `목표: "${target}" 달성을 가로막는 현실적인 장애물 5가지를 분석하세요.
    
    [작성 규칙 - 매우 중요]:
    1. 장애물은 '행위(Action)'가 아닌 '부정적인 상태(Condition)'로 표현해야 합니다.
    2. 말투는 반드시 격식 없는 평어체(해라체, "~다")를 사용하세요. 
    3. "~부족하다", "~이 없다", "~를 모른다"와 같이 자연스러운 서술형 어미(~다)로 끝내세요.
    4. 명사형 종결(~부족, ~부재)은 사용하지 마세요.
    
    반드시 한국어로 JSON 형식으로 응답하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          obstacles: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["obstacles"]
      }
    }
  });
  return JSON.parse(response.text).obstacles;
};

export const suggestIOs = async (obstacles: string[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `다음 장애물들을 극복했을 때의 긍정적인 성취 상태인 '중간목표(IO)'로 변환하세요.
    장애물 리스트: ${JSON.stringify(obstacles)}
    
    [작성 규칙]:
    1. 장애를 극복한 후의 '긍정적인 상태'를 기술하세요.
    2. "~한다", "~를 갖춘다", "~가 완료된다" 등 평어체 서술형(~다)으로 끝내세요.
    
    반드시 한국어로 JSON 형식으로 응답하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                obstacle: { type: Type.STRING },
                io: { type: Type.STRING }
              }
            }
          }
        },
        required: ["mappings"]
      }
    }
  });
  return JSON.parse(response.text).mappings;
};

export const suggestSequence = async (ios: { id: string, text: string }[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `이 중간목표들(IO) 사이의 '논리적 선행 조건'을 분석하세요. 
    IO 리스트: ${JSON.stringify(ios)}
    어떤 목표가 먼저 달성되어야 다음 단계로 나아갈 수 있는지 인과관계를 판단하여 선행 목표 ID를 지정하세요.
    반드시 JSON 형식으로 각 ID별 선행 목표 ID 배열을 응답하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dependencies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                prerequisiteIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          }
        },
        required: ["dependencies"]
      }
    }
  });
  return JSON.parse(response.text).dependencies;
};

export const suggestActionPlan = async (ioText: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `중간목표: "${ioText}" 달성을 위한 구체적인 활동계획(Action Item)을 3개 제안하세요.
    "무엇을 해야 하는가"에 집중하여 구체적인 행동 위주로 작성하세요.
    반드시 한국어로 JSON 형식으로 응답하세요.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          actions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["actions"]
      }
    }
  });
  return JSON.parse(response.text).actions;
};
