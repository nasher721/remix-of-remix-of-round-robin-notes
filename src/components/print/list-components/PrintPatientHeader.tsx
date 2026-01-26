import { Patient } from '@/types/patient';
import * as React from 'react';

interface PrintPatientHeaderProps {
    patient: Patient;
    index: number;
    fontSize: number;
}

export const PrintPatientHeader = ({ patient, index, fontSize }: PrintPatientHeaderProps) => {
    return (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span
                    className="bg-white text-primary rounded-full w-10 h-10 flex items-center justify-center font-bold"
                    style={{ fontSize: `${fontSize + 2}px` }}
                >
                    {index + 1}
                </span>
                <span className="font-bold" style={{ fontSize: `${fontSize + 4}px` }}>
                    {patient.name || 'Unnamed'}
                </span>
            </div>
            {patient.bed && (
                <span
                    className="bg-white/20 px-4 py-1.5 rounded font-medium"
                    style={{ fontSize: `${fontSize}px` }}
                >
                    Bed: {patient.bed}
                </span>
            )}
        </div>
    );
};
