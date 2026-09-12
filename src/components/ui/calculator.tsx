'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Calculator() {
  const [input, setInput] = React.useState('');
  const [result, setResult] = React.useState('');
  const calculatorRef = React.useRef<HTMLDivElement>(null);

  const handleInteraction = React.useCallback((value: string) => {
    if (value === '=') {
      if (!input || result) return;
      try {
        const evalResult = new Function('return ' + input)();
        if (isNaN(evalResult) || !isFinite(evalResult)) {
            setResult('Error');
        } else {
            setResult(String(evalResult));
        }
      } catch (error) {
        setResult('Error');
      }
      return;
    }

    if (value === 'C') {
      setInput('');
      setResult('');
      return;
    }
    
    if (value === 'Backspace') {
      if (result) {
        setInput('');
        setResult('');
      } else {
        setInput(currentInput => currentInput.slice(0, -1));
      }
      return;
    }

    if (result) {
      if (/[+\-*/]/.test(value)) {
        setInput(result + value);
      } else {
        setInput(value);
      }
      setResult('');
    } else {
      setInput(currentInput => currentInput + value);
    }
  }, [input, result]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    let handled = true;

    if (/[0-9.]/.test(key)) {
      handleInteraction(key);
    } else if (/[+\-*/]/.test(key)) {
      handleInteraction(key);
    } else if (key === 'Enter' || key === '=') {
      handleInteraction('=');
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      handleInteraction('C');
    } else if (key === 'Backspace') {
      handleInteraction('Backspace');
    } else {
      handled = false;
    }

    if (handled) {
      e.preventDefault();
    }
  }, [handleInteraction]);

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '=', '+',
    'C'
  ];

  return (
    <div 
      ref={calculatorRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={() => calculatorRef.current?.focus()}
      className="bg-background p-4 rounded-lg border shadow-lg max-w-xs mx-auto outline-none"
    >
      <div className="grid gap-4">
        <Input
          type="text"
          value={result ? result : input}
          readOnly
          className="text-right text-3xl font-mono h-20 bg-muted/20 border-0 rounded-md p-4"
          placeholder="0"
        />
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((btn) => (
            <Button
              key={btn}
              onClick={() => handleInteraction(btn)}
              variant="outline"
              className={cn(
                "text-xl h-16 rounded-md transition-all duration-200 ease-in-out",
                {
                  'col-span-1': btn !== 'C',
                  'col-span-4': btn === 'C',
                  'bg-primary/80 text-primary-foreground hover:bg-primary': btn === '=',
                  'bg-destructive/80 text-destructive-foreground hover:bg-destructive': btn === 'C'
                }
              )}
            >
              {btn}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
