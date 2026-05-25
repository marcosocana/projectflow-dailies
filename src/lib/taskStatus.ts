export type TaskEnvironment = 'DEV' | 'PRE' | 'PRO';
export type IncidentStatus = 'pending' | 'in_progress' | 'resolved' | 'closed' | 'in_qa' | 'blocked';
export type TaskStatus = 'pending' | 'in_progress' | 'resolved' | 'resolved_yesterday' | 'blocked';
export type AssignmentStatusValue =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'resolved_DEV'
  | 'resolved_PRE'
  | 'resolved_PRO'
  | 'closed';

export const TASK_ENVIRONMENTS: TaskEnvironment[] = ['DEV', 'PRE', 'PRO'];

export const INCIDENT_STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'WIP' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'blocked', label: 'Block' },
  { value: 'closed', label: 'Cerrada' },
];

export const ASSIGNMENT_STATUS_OPTIONS: Array<{ value: AssignmentStatusValue; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'WIP' },
  { value: 'resolved_DEV', label: 'Resuelta - En DEV' },
  { value: 'resolved_PRE', label: 'Resuelta - En PRE' },
  { value: 'resolved_PRO', label: 'Resuelta - En PRO' },
  { value: 'blocked', label: 'Block' },
  { value: 'closed', label: 'Cerrada' },
];

export const normalizeEnvironment = (environment: string | null | undefined): TaskEnvironment | null => {
  const value = String(environment || '').toUpperCase();
  if (value === 'QA') return 'PRE';
  return TASK_ENVIRONMENTS.includes(value as TaskEnvironment) ? value as TaskEnvironment : null;
};

export const isResolvedStatus = (status: string | null | undefined) =>
  status === 'resolved' || status === 'closed' || status === 'in_qa' || status === 'resolved_yesterday';

export const getIncidentStatusLabel = (
  status: IncidentStatus | string | null | undefined,
) => {
  if (status === 'pending') return 'Pendiente';
  if (status === 'in_progress') return 'WIP';
  if (status === 'blocked') return 'Block';
  if (status === 'closed') return 'Cerrada';
  if (status === 'in_qa' || status === 'resolved') return 'Resuelta';
  return String(status || 'Pendiente');
};

export const getTaskStatusLabel = (
  status: TaskStatus | string | null | undefined,
) => {
  if (status === 'in_progress') return 'WIP';
  if (status === 'blocked') return 'Block';
  if (status === 'resolved') return 'Resuelta';
  if (status === 'resolved_yesterday') return 'Resuelta ayer';
  return 'Pendiente';
};

export const getResolvedSubstatusLabel = (
  status: IncidentStatus | TaskStatus | string | null | undefined,
  environment?: string | null,
) => {
  if (!isResolvedStatus(status)) return '-';
  return `En ${normalizeEnvironment(status === 'in_qa' ? 'PRE' : environment) || 'PRO'}`;
};

export const getStatusLogValue = (
  status: IncidentStatus | TaskStatus | string | null | undefined,
  environment?: string | null,
) => {
  if (status === 'in_qa') return 'resolved_PRE';
  if (status === 'closed') return 'resolved_PRO';
  if (status === 'resolved' || status === 'resolved_yesterday') {
    return `resolved_${normalizeEnvironment(environment) || 'PRO'}`;
  }
  return String(status || 'pending');
};

export const getStatusLogLabel = (status: string | null | undefined) => {
  if (status === 'resolved_DEV') return 'Resuelta - En DEV';
  if (status === 'resolved_PRE') return 'Resuelta - En PRE';
  if (status === 'resolved_PRO') return 'Resuelta - En PRO';
  return getIncidentStatusLabel(status);
};

export const getIncidentStatusTone = (status: IncidentStatus | string | null | undefined) => {
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (status === 'resolved' || status === 'in_qa') return 'bg-green-100 text-green-800 border-green-300';
  if (status === 'blocked') return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
};

export const getAppStatusTone = (status: IncidentStatus | TaskStatus | string | null | undefined) => {
  if (status === 'in_progress') return 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] border-transparent';
  if (status === 'resolved' || status === 'resolved_yesterday' || status === 'in_qa') return 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-transparent';
  if (status === 'blocked') return 'bg-destructive text-destructive-foreground border-transparent';
  if (status === 'closed') return 'bg-slate-700 text-white border-transparent';
  return 'bg-muted text-muted-foreground border-transparent';
};

export const mapIncidentStatusToTaskStatus = (status: IncidentStatus | string): TaskStatus => {
  if (status === 'closed' || status === 'resolved' || status === 'in_qa') return 'resolved';
  if (status === 'blocked') return 'blocked';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
};

export const mapTaskStatusToIncidentStatus = (status: TaskStatus | string): IncidentStatus => {
  if (status === 'resolved' || status === 'resolved_yesterday') return 'resolved';
  if (status === 'blocked') return 'blocked';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
};

export const assignmentToSelectValue = (
  status: IncidentStatus | string,
  environment?: string | null,
): AssignmentStatusValue => {
  if (status === 'closed') return 'closed';
  if (status === 'blocked') return 'blocked';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'resolved' || status === 'in_qa') {
    return `resolved_${normalizeEnvironment(status === 'in_qa' ? 'PRE' : environment) || 'PRO'}` as AssignmentStatusValue;
  }
  return 'pending';
};

export const selectValueToAssignment = (
  value: AssignmentStatusValue,
): { status: IncidentStatus; environment: TaskEnvironment | null } => {
  if (value === 'resolved_DEV') return { status: 'resolved', environment: 'DEV' };
  if (value === 'resolved_PRE') return { status: 'resolved', environment: 'PRE' };
  if (value === 'resolved_PRO') return { status: 'resolved', environment: 'PRO' };
  if (value === 'closed') return { status: 'closed', environment: 'PRO' };
  if (value === 'blocked') return { status: 'blocked', environment: null };
  if (value === 'in_progress') return { status: 'in_progress', environment: null };
  return { status: 'pending', environment: null };
};
