import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const ColorPicker = ({ value, onChange, label }: ColorPickerProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);

  const predefinedColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#F43F5E', // Rose
  ];

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    // If input is not a valid hex, revert to current value
    if (!/^#[0-9A-Fa-f]{6}$/.test(inputValue)) {
      setInputValue(value);
    }
  };

  const handleColorSelect = (color: string) => {
    setInputValue(color);
    onChange(color);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            placeholder="#3B82F6"
            className="font-mono"
          />
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              style={{ backgroundColor: value }}
            >
              <Palette className="h-4 w-4" style={{ color: value === '#FFFFFF' ? '#000000' : '#FFFFFF' }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Colores predefinidos</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded border-2 border-border hover:border-primary transition-colors"
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorSelect(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Color personalizado</Label>
                <Input
                  type="color"
                  value={value}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  className="h-8 p-0 border-0 cursor-pointer"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export { ColorPicker };