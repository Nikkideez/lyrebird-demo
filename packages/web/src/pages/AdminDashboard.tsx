import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Appointment } from "@/lib/api";
import { Shield, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 10;

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        from?: string;
        to?: string;
        limit: number;
        offset: number;
      } = { limit: PAGE_SIZE, offset };
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(`${to}T23:59:59`).toISOString();
      const data = await api.getAllAppointments(params);
      setAppointments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, offset]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            All appointments across all clinicians
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setOffset(0); }}>
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading...</p>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No appointments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium px-4 py-3">Date & Time</th>
                  <th className="text-left font-medium px-4 py-3">Clinician</th>
                  <th className="text-left font-medium px-4 py-3">Patient</th>
                  <th className="text-left font-medium px-4 py-3">Duration</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => {
                  const start = new Date(apt.start);
                  const end = new Date(apt.end);
                  const durationMin = Math.round(
                    (end.getTime() - start.getTime()) / 60000
                  );
                  return (
                    <tr
                      key={apt.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {format(start, "MMM d, yyyy")}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {format(start, "h:mm a")} — {format(end, "h:mm a")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{apt.clinicianName || apt.clinicianId}</div>
                        {apt.clinicianSpecialty && (
                          <div className="text-muted-foreground text-xs">
                            {apt.clinicianSpecialty}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>{apt.patientName || apt.patientId}</div>
                        {apt.patientEmail && (
                          <div className="text-muted-foreground text-xs">
                            {apt.patientEmail}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {durationMin} min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {Math.floor(offset / PAGE_SIZE) + 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={appointments.length < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
