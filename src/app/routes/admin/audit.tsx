import { useState } from "react";
import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { fetchAllAuditLogs } from "@/features/games/api";
import { useAuditLogs } from "@/features/games/hooks";
import { formatDateTime } from "@/lib/format";
import {
  auditActionLabel,
  auditEntityLabel,
  formatAuditDetails,
  serializeAuditLogsRaw,
} from "@/lib/audit-format";

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useAuditLogs(page);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  const handleCopyAll = async () => {
    setCopying(true);
    setCopied(false);
    try {
      const logs = await fetchAllAuditLogs();
      await navigator.clipboard.writeText(serializeAuditLogsRaw(logs));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Auditoría</h1>
        <p className="text-base text-muted-foreground">
          Registro inmutable de acciones administrativas.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Eventos</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={copying || isLoading}
            onClick={handleCopyAll}
          >
            <Copy />
            {copying ? "Copiando…" : copied ? "Copiado" : "Copiar registro completo"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Acción</th>
                    <th className="px-2 py-2">Entidad</th>
                    <th className="px-2 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).map((log) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-2 py-2">{auditActionLabel(log.action)}</td>
                      <td
                        className="px-2 py-2"
                        title={log.entity_id ?? undefined}
                      >
                        {auditEntityLabel(log.entity_type)}
                      </td>
                      <td className="px-2 py-2 max-w-md text-muted-foreground whitespace-normal">
                        {formatAuditDetails(log)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
