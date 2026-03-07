/**
 * Accessible Patient Card Example
 * 
 * Demonstrates accessibility best practices:
 * - Semantic HTML
 * - ARIA labels
 * - Keyboard navigation
 * - Screen reader announcements
 * - Focus management
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  useAnnouncer, 
  usePatientAnnouncer,
  getStatusA11yText,
  usePrefersReducedMotion,
} from '@/lib/accessibility';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  room: string;
  status: 'stable' | 'critical' | 'improving' | 'declining';
  diagnosis: string;
  age: number;
  allergies: string[];
}

interface AccessiblePatientCardProps {
  patient: Patient;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export function AccessiblePatientCard({
  patient,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
}: AccessiblePatientCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { announce } = useAnnouncer();
  const patientAnnouncer = usePatientAnnouncer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Status colors for visual indication
  const statusColors = {
    stable: 'bg-green-100 text-green-800 border-green-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
    improving: 'bg-blue-100 text-blue-800 border-blue-200',
    declining: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    announce(
      isExpanded 
        ? `${patient.name}'s details collapsed` 
        : `${patient.name}'s details expanded`
    );
  };

  const handleEdit = () => {
    onEdit(patient.id);
    patientAnnouncer.announcePatientSelected(patient.name);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete patient ${patient.name}?`)) {
      onDelete(patient.id);
      patientAnnouncer.announcePatientRemoved(patient.name);
    }
  };

  const handleSelect = () => {
    onSelect(patient.id);
    patientAnnouncer.announcePatientSelected(patient.name);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect();
        break;
      case 'e':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleEdit();
        }
        break;
      case 'Delete':
        if (e.shiftKey) {
          e.preventDefault();
          handleDelete();
        }
        break;
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
      className={`
        relative rounded-lg border-2 transition-colors
        ${isSelected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border'}
        ${patient.status === 'critical' ? 'ring-2 ring-red-500 ring-offset-2' : ''}
      `}
      role="article"
      aria-labelledby={`patient-name-${patient.id}`}
      aria-describedby={`patient-status-${patient.id}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleSelect}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 
                  id={`patient-name-${patient.id}`}
                  className="text-lg font-semibold"
                >
                  {patient.name}
                </h3>
                <Badge 
                  id={`patient-status-${patient.id}`}
                  variant="outline"
                  className={statusColors[patient.status]}
                  aria-label={getStatusA11yText(patient.status)}
                >
                  {patient.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Room {patient.room} • Age {patient.age}
              </p>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                aria-label={`Edit ${patient.name}`}
                title="Edit patient (Ctrl+E)"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                aria-label={`Delete ${patient.name}`}
                title="Delete patient (Shift+Delete)"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                aria-expanded={isExpanded}
                aria-controls={`patient-details-${patient.id}`}
                aria-label={isExpanded ? 'Hide details' : 'Show details'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent 
            id={`patient-details-${patient.id}`}
            role="region"
            aria-label={`${patient.name} details`}
          >
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">
                  Diagnosis
                </h4>
                <p className="text-sm">{patient.diagnosis}</p>
              </div>

              {patient.allergies.length > 0 && (
                <div role="alert" aria-live="assertive">
                  <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
                    <span aria-hidden="true">⚠️</span>
                    Allergies
                  </h4>
                  <ul className="text-sm list-disc list-inside">
                    {patient.allergies.map((allergy, index) => (
                      <li key={index} className="text-red-700">
                        {allergy}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Patient ID: <span className="font-mono">{patient.id}</span>
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

/**
 * Usage Example
 */
export function AccessiblePatientCardExample() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const mockPatient: Patient = {
    id: 'patient-123',
    name: 'John Doe',
    room: 'ICU-101',
    status: 'critical',
    diagnosis: 'Acute Respiratory Failure',
    age: 65,
    allergies: ['Penicillin', 'Sulfa drugs'],
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-xl font-bold mb-4">Accessible Patient Card Demo</h2>
      <AccessiblePatientCard
        patient={mockPatient}
        onEdit={(id) => console.log('Edit:', id)}
        onDelete={(id) => console.log('Delete:', id)}
        onSelect={setSelectedId}
        isSelected={selectedId === mockPatient.id}
      />
      
      <div className="mt-4 p-4 bg-muted rounded text-sm">
        <h3 className="font-semibold mb-2">Accessibility Features:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Full keyboard navigation (Tab, Enter, Space)</li>
          <li>Keyboard shortcuts (Ctrl+E to edit, Shift+Delete to delete)</li>
          <li>ARIA labels for all interactive elements</li>
          <li>Screen reader announcements for actions</li>
          <li>Reduced motion support</li>
          <li>Visual focus indicators</li>
          <li>Status announcements</li>
          <li>Allergy alerts with assertive live region</li>
        </ul>
      </div>
    </div>
  );
}
