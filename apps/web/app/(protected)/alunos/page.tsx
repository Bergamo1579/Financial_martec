import { apiFetch } from '@/lib/server-api';

async function getStudents() {
  const response = await apiFetch('/v1/alunos?take=50');
  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<
    Array<{
      sourceId: string;
      name: string;
      cpf: string;
      email?: string | null;
      companySnapshot?: {
        name: string;
      } | null;
      lastSyncedAt: string;
    }>
  >;
}

export default async function StudentsPage() {
  const students = await getStudents();

  return (
    <section className="table-panel">
      <div className="table-toolbar">
        <div>
          <span className="eyebrow">Read Model</span>
          <h2 style={{ margin: 0 }}>Alunos visíveis no financeiro sem espelhar o pedagógico inteiro</h2>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>CPF</th>
            <th>Empresa</th>
            <th>Último sync</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.sourceId}>
              <td>
                <div className="stack">
                  <strong>{student.name}</strong>
                  <span className="muted">{student.email ?? 'Sem e-mail'}</span>
                </div>
              </td>
              <td>{student.cpf}</td>
              <td>{student.companySnapshot?.name ?? 'Empresa não encontrada no snapshot'}</td>
              <td>{new Date(student.lastSyncedAt).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
