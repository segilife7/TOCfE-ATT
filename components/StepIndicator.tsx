
import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { num: AppStep.TARGET, label: "야심찬 목표" },
    { num: AppStep.OBSTACLES, label: "장애 발견" },
    { num: AppStep.IOS, label: "중간목표 설정" },
    { num: AppStep.SEQUENCE, label: "순서 정하기" },
    { num: AppStep.ACTION_PLAN, label: "행동계획" },
  ];

  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4 mb-12">
      {steps.map((s, idx) => (
        <React.Fragment key={s.num}>
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 border-2 transition-all duration-500 ${
              currentStep >= s.num 
                ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" 
                : "bg-white border-slate-200 text-slate-300"
            }`}>
              {currentStep > s.num ? <i className="fa-solid fa-check"></i> : s.num}
            </div>
            <span className={`absolute top-12 whitespace-nowrap text-[11px] font-bold ${
              currentStep >= s.num ? "text-emerald-700" : "text-slate-400"
            }`}>
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-grow h-1 mx-2 rounded-full transition-all duration-500 ${
              currentStep > s.num ? "bg-emerald-600" : "bg-slate-100"
            }`}></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepIndicator;
