import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEW_PROCESS_VALUE = '__new_process__';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

interface ProcessSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Procesos existentes que puede elegir quien edita. */
  options: string[];
  placeholder?: string;
}

/**
 * Desplegable de procesos con la opción de dar de alta uno nuevo (cualquier rol).
 * El nombre nuevo solo se aplica al pulsar "Añadir" o Enter, nunca mientras se escribe,
 * y si coincide con uno existente (sin tener en cuenta mayúsculas ni tildes) se usa ese.
 */
export default function ProcessSelect({ value, onChange, options, placeholder = 'Seleccionar' }: ProcessSelectProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const list = useMemo(() => {
    const unique = new Map<string, string>();
    [...options, value].forEach(option => {
      const label = String(option ?? '').trim();
      if (label && !unique.has(normalize(label))) unique.set(normalize(label), label);
    });
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [options, value]);

  const commit = () => {
    const name = draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const existing = list.find(option => normalize(option) === normalize(name));
    onChange(existing ?? name);
    setAdding(false);
    setDraft('');
  };

  const cancel = () => {
    setAdding(false);
    setDraft('');
  };

  if (adding) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          className="min-w-0 flex-1 basis-40"
          value={draft}
          maxLength={80}
          placeholder="Nombre del nuevo proceso"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
        />
        <Button type="button" size="sm" onClick={commit} disabled={!draft.trim()}>
          Añadir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={next => {
        if (next === NEW_PROCESS_VALUE) {
          setAdding(true);
          return;
        }
        onChange(next);
      }}
    >
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {list.map(option => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
        {list.length > 0 && <SelectSeparator />}
        <SelectItem value={NEW_PROCESS_VALUE}>+ Nuevo proceso...</SelectItem>
      </SelectContent>
    </Select>
  );
}
