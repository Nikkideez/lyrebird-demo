const BASE_URL = "/api";

export type Role = "patient" | "clinician" | "admin";

let _currentRole: Role = "admin";

export function setRole(role: Role) {
  _currentRole = role;
}

export function getRole(): Role {
  return _currentRole;
}

async function request<T>(
  path: string,
  options: RequestInit & { role?: string } = {}
): Promise<T> {
  const { role = _currentRole, ...fetchOptions } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      "X-Role": role,
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, error.message || res.statusText, error);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface Clinician {
  id: string;
  name: string;
  specialty: string | null;
}

export interface Patient {
  id: string;
  name: string;
  email: string | null;
}

export interface Appointment {
  id: string;
  clinicianId: string;
  patientId: string;
  start: string;
  end: string;
  createdAt: string | null;
  clinicianName?: string | null;
  clinicianSpecialty?: string | null;
  patientName?: string | null;
  patientEmail?: string | null;
}

export const api = {
  getClinicians: () => request<Clinician[]>("/clinicians"),

  getPatients: () => request<Patient[]>("/patients"),

  createAppointment: (data: {
    clinicianId: string;
    patientId: string;
    start: string;
    end: string;
    clinicianName?: string;
    patientName?: string;
    patientEmail?: string;
  }) =>
    request<Appointment>("/appointments", {
      method: "POST",
      body: JSON.stringify(data),
      role: _currentRole,
    }),

  getClinicianAppointments: (
    clinicianId: string,
    params?: { from?: string; to?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const query = qs.toString() ? `?${qs}` : "";
    return request<Appointment[]>(
      `/clinicians/${clinicianId}/appointments${query}`,
      { role: _currentRole }
    );
  },

  getAllAppointments: (params?: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString() ? `?${qs}` : "";
    return request<Appointment[]>(`/appointments${query}`, { role: _currentRole });
  },
};
