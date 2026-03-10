import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({ label, required, id, className = '', ...props }) => (
  <div>
    {label && (
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 mb-1">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
    )}
    <input
      id={id}
      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 ${className}`}
      {...props}
    />
  </div>
);

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, required, id, className = '', children, ...props }) => (
  <div>
    {label && (
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 mb-1">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
    )}
    <select
      id={id}
      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({ label, required, id, className = '', ...props }) => (
  <div>
    {label && (
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 mb-1">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
    )}
    <textarea
      id={id}
      className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 resize-none ${className}`}
      {...props}
    />
  </div>
);
