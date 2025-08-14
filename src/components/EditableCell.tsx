import React, { useState } from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Check, X, ExternalLink } from 'lucide-react';

interface DetailedColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  default_value?: string;
  udt_name: string;
}

interface EditableCellProps {
  value: any;
  columnInfo: DetailedColumnInfo;
  onSave: (value: any) => void;
  enumValues?: string[];
  rowIndex: number;
  columnIndex: number;
  onOpenRelatedTable?: (tableName: string, schemaName: string, foreignKeyValue: any, columnName: string) => void;
  foreignKeyInfo?: any;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  columnInfo,
  onSave,
  enumValues = [],
  onOpenRelatedTable,
  foreignKeyInfo
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div 
        className="p-2 cursor-pointer hover:bg-gray-700/30 min-h-[32px] flex items-center justify-between"
        onClick={() => setIsEditing(true)}
        title="Click to edit"
      >
        <span className="font-mono text-sm truncate flex-1">
          {formatValue(value)}
        </span>
        {columnInfo.is_foreign_key && foreignKeyInfo && value !== null && value !== undefined && onOpenRelatedTable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-2 text-purple-400 hover:text-purple-300"
            onClick={(e) => {
              e.stopPropagation();
          onOpenRelatedTable(
            foreignKeyInfo.referenced_table,
            foreignKeyInfo.referenced_schema || 'public',
            value,
            foreignKeyInfo.referenced_column
          );
            }}
            title="Open related table"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-1 bg-blue-900/20 border border-blue-500/30">
      <div className="flex items-center space-x-1">
        {enumValues.length > 0 ? (
          <Select value={String(editValue)} onValueChange={(val) => setEditValue(val)}>
            <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-600">
              <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
              {enumValues.map((enumVal) => (
                <SelectItem key={enumVal} value={enumVal} className="text-white">
                  {enumVal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
        ) : columnInfo.data_type.toLowerCase().includes('bool') ? (
          <Select value={String(editValue)} onValueChange={(val) => setEditValue(val === 'true')}>
            <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="true" className="text-white">true</SelectItem>
              <SelectItem value="false" className="text-white">false</SelectItem>
            </SelectContent>
          </Select>
        ) : (
                    <Input
                    value={editValue || ''}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
            className="h-6 text-xs bg-gray-800 border-gray-600"
            autoFocus
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="h-6 w-6 p-0 text-green-400"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-6 w-6 p-0 text-red-400"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default EditableCell;