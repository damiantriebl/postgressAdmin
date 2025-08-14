import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
  className?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  text = 'Loading...', 
  className = '' 
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className={`
      fixed inset-0 bg-black/50 backdrop-blur-sm z-50 
      flex items-center justify-center
      ${className}
    `}>
      <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-6 shadow-xl">
        <LoadingSpinner size="lg" text={text} className="justify-center" />
      </div>
    </div>
  );
};

export default LoadingOverlay;