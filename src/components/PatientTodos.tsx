import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  ListTodo, 
  Plus, 
  Sparkles, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { PatientTodo, TodoSection } from '@/types/todo';
import { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';

interface PatientTodosProps {
  todos: PatientTodo[];
  section: string | null;
  patient: Patient;
  generating: boolean;
  onAddTodo: (content: string, section: string | null) => Promise<PatientTodo | undefined>;
  onToggleTodo: (todoId: string) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onGenerateTodos: (patient: Patient, section: TodoSection) => Promise<void>;
  /** If true, todos are rendered inline (always visible) instead of in a popover */
  alwaysVisible?: boolean;
}

export function PatientTodos({
  todos,
  section,
  patient,
  generating,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onGenerateTodos,
  alwaysVisible = false,
}: PatientTodosProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const sectionTodos = todos.filter(t => t.section === section);
  const incompleteTodos = sectionTodos.filter(t => !t.completed);
  const completedTodos = sectionTodos.filter(t => t.completed);

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;
    await onAddTodo(newTodoText.trim(), section);
    setNewTodoText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTodo();
    }
  };

  const handleGenerate = async () => {
    const todoSection = section === null ? 'all' : section as TodoSection;
    await onGenerateTodos(patient, todoSection);
  };

  // Shared todo list content
  const TodoListContent = () => (
    <div className="space-y-2">
      {/* Add new todo */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a todo..."
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button 
          size="sm" 
          onClick={handleAddTodo}
          disabled={!newTodoText.trim()}
          className="h-8 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Todo list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {incompleteTodos.length === 0 && completedTodos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No todos yet. Add one or generate with AI.
          </p>
        )}

        {incompleteTodos.map(todo => (
          <div 
            key={todo.id} 
            className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 group"
          >
            <Checkbox
              checked={false}
              onCheckedChange={() => onToggleTodo(todo.id)}
              className="mt-0.5"
            />
            <span className="flex-1 text-sm leading-tight">
              {todo.content}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteTodo(todo.id)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}

        {completedTodos.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground pt-2 pb-1">
              Completed ({completedTodos.length})
            </div>
            {completedTodos.map(todo => (
              <div 
                key={todo.id} 
                className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 group opacity-60"
              >
                <Checkbox
                  checked={true}
                  onCheckedChange={() => onToggleTodo(todo.id)}
                  className="mt-0.5"
                />
                <span className="flex-1 text-sm leading-tight line-through">
                  {todo.content}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteTodo(todo.id)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  // Always visible inline mode
  if (alwaysVisible) {
    return (
      <div className="border border-border rounded-lg bg-muted/20 overflow-hidden">
        {/* Header with expand/collapse */}
        <div 
          className="flex items-center justify-between px-3 py-2 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {section ? 'Section' : 'Patient'} To-Dos
            </span>
            {sectionTodos.length > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                incompleteTodos.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {incompleteTodos.length}/{sectionTodos.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerate();
              }}
              disabled={generating}
              className="h-7 text-xs gap-1"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">AI Generate</span>
            </Button>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {/* Collapsible content */}
        {isExpanded && (
          <div className="px-3 py-2">
            <TodoListContent />
          </div>
        )}
      </div>
    );
  }

  // Popover mode (default)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "h-7 px-2 gap-1",
            sectionTodos.length > 0 && "text-primary"
          )}
        >
          <ListTodo className="h-3.5 w-3.5" />
          {sectionTodos.length > 0 && (
            <span className="text-xs font-medium">
              {incompleteTodos.length}/{sectionTodos.length}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {section ? 'Section' : 'Patient'} To-Dos
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="h-7 text-xs gap-1"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI Generate
            </Button>
          </div>

          <TodoListContent />
        </div>
      </PopoverContent>
    </Popover>
  );
}
