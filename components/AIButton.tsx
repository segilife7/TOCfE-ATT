
import React from 'react';

interface AIButtonProps {
  onClick: () => Promise<void>;
  label: string;
  icon?: string;
  disabled?: boolean;
}

const AIButton: React.FC<AIButtonProps> = ({ onClick, label, icon = "fa-wand-magic-sparkles", disabled = false }) => {
  const [loading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <i className="fa-solid fa-circle-notch fa-spin"></i>
      ) : (
        <i className={`fa-solid ${icon}`}></i>
      )}
      <span className="font-medium">{loading ? "Generating..." : label}</span>
    </button>
  );
};

export default AIButton;
