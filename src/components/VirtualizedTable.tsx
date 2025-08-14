import React from 'react';

interface VirtualizedTableProps {
  columns: string[];
  rows: any[][];
  height: number;
  rowHeight: number;
  onCellClick?: (rowIndex: number, columnIndex: number, value: any) => void;
  getCellClassName?: (value: any) => string;
  formatCellValue?: (value: any) => string;
}

const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  columns,
  rows,
  height,
  rowHeight,
  onCellClick,
  getCellClassName,
  formatCellValue
}) => {
  const formatValue = (value: any): string => {
    if (formatCellValue) return formatCellValue(value);
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getClassName = (value: any): string => {
    if (getCellClassName) return getCellClassName(value);
    return '';
  };

  return (
    <div 
      className="border border-gray-700 bg-gray-900"
      style={{ height: `${height}px` }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700">
        <div className="flex">
          {columns.map((column, index) => (
            <div
              key={index}
              className="min-w-[120px] px-3 py-2 border-r border-gray-700 last:border-r-0 bg-gray-900"
            >
              <span className="font-semibold text-white text-sm">{column}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body - Simple implementation without virtualization for now */}
      <div 
        className="overflow-auto"
        style={{ height: `${height - 40}px` }}
      >
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex border-b border-gray-700 hover:bg-gray-800/30">
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className={`min-w-[120px] px-3 py-2 border-r border-gray-700 last:border-r-0 text-sm cursor-pointer ${getClassName(cell)}`}
                style={{ height: `${rowHeight}px` }}
                onClick={() => onCellClick?.(rowIndex, cellIndex, cell)}
                title={formatValue(cell)}
              >
                <div className="truncate">
                  {formatValue(cell)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualizedTable;