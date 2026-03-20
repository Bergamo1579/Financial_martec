import type { PaginatedResponse, StudentListItem } from '@financial-martec/contracts';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficeStudentsPage() {
  const [, students] = await Promise.all([
    requireScreen('/backoffice/alunos', 'BACKOFFICE'),
    apiFetchJson<PaginatedResponse<StudentListItem>>('/v1/alunos?page=1&pageSize=50'),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Alunos</span>
        <h2 className="auth-title">Leitura operacional de alunos.</h2>
        <p className="auth-copy">Dados normalizados para atendimento do backoffice.</p>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>{students.total} registros</strong>
        </div>

        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>CPF</th>
              <th>Empresa</th>
              <th>Ultimo sync</th>
            </tr>
          </thead>
          <tbody>
            {students.items.map((student) => (
              <tr key={student.sourceId}>
                <td className="stack">
                  <strong>{student.name}</strong>
                  <span className="muted">{student.email ?? 'Sem e-mail'}</span>
                </td>
                <td>{student.cpf}</td>
                <td>{student.company?.name ?? 'Nao vinculada'}</td>
                <td>{new Date(student.lastSyncedAt).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
