import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Check, Download, LockKeyhole, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Audience = "Aluno" | "Comerciante";
type Question = { 
  id: string; 
  title: string; 
  help?: string; 
  options?: string[]; 
  conditional?: (answers: Record<string, string>) => boolean; 
  kind?: "text" 
};
type ResponseRecord = { 
  id: string; 
  audience: Audience; 
  answers: Record<string, string>; 
  createdAt: string;
  contact_name?: string;
  contact_whatsapp?: string;
};

const STORAGE_KEY = "transforme-responses";
const ADMIN_PASSWORD = "transforme2026";

const studentQuestions: Question[] = [
  { id: "program", title: "Você faz parte do programa Transforme-se?", options: ["Sim", "Não"] },
  { id: "class", title: "Qual é sua turma do Transforme-se?", options: ["Turma de Ruth", "Turma de Carrasco", "Turma Anicely", "Turma Radássila", "Outra"], conditional: a => a.program === "Sim" },
  { id: "study", title: "Quanto tempo de Formação/Curso/Estudo em Tecnologia você tem?", options: ["Entre 1 a 4 meses", "Entre 5 a 8 meses", "Mais de 9 meses"] },
  { id: "real", title: "Você já fez algum projeto real para alguém fora do curso?", options: ["Sim", "Não"] },
  { id: "portfolio", title: "O que mais falta no seu portfólio hoje para você se sentir pronto para uma vaga júnior?", options: ["Projetos para clientes reais", "Projetos publicados no ar", "Feedback de alguém da área", "Ainda não sei", "Outro"] },
  { id: "volunteer", title: "Você toparia fazer um projeto voluntário ou simbólico para ganhar uma prova de portfólio com avaliação real?", options: ["Sim", "Talvez", "Não"] },
  { id: "hours", title: "Quantas horas por semana você teria disponível para isso, além do curso?", options: ["Até 2h", "2h a 5h", "Mais de 5h"] },
  { id: "delivery", title: "Você se sentiria confortável entregando um projeto direto para um cliente real, ou prefere que alguém revisem antes?", options: ["Confortável direto", "Prefiro que revisem antes"] },
];

const merchantQuestions: Question[] = [
  { id: "business", title: "Qual é o tipo do seu negócio?", options: ["Padaria", "Salão/Barbearia", "Costura/Confecção", "Alimentação", "Comércio em geral", "Outro"] },
  { id: "internet", title: "Qual é a situação atual do seu negócio na internet?", options: ["Não tenho site", "Tenho página simples de links/catálogo", "Já tenho site profissional"] },
  { id: "barrier", title: "O que mais impede hoje seu negócio de ter um site profissional?", options: ["Acho caro ou complicado", "Falta tempo para organizar conteúdo", "Não encontro profissional de confiança"], conditional: a => a.internet === "Não tenho site" || a.internet === "Tenho página simples de links/catálogo" },
  { id: "results", title: "O seu site atual traz os resultados e vendas que você esperava?", options: ["Sim", "Não, precisa ser atualizado", "Não sei medir"], conditional: a => a.internet === "Já tenho site profissional" },
  { id: "trust", title: "Você sabia que uma presença digital organizada pode aumentar a confiança dos clientes?", options: ["Sim, já sabia", "Não sabia", "Concordo totalmente"] },
  { id: "whatsapp", title: "Quanto tempo você perde no WhatsApp respondendo as mesmas dúvidas?", options: ["Muito tempo! Atrapalha a rotina", "Um tempo razoável", "Pouco tempo"] },
  { id: "condition", title: "Em qual condição você aceitaria um site criado por um estudante?", options: ["Aceitaria imediatamente", "Com supervisão de professor/profissional", "Vendo trabalhos anteriores", "Com prazo garantido"] },
  { id: "price", title: "Quanto você imagina que custaria criar um site profissional hoje?", options: ["Até R$ 100", "Entre R$ 100 e R$ 300", "Entre R$ 300 e R$ 800", "Acima de R$ 800", "Não faço ideia"] },
  { id: "impact", title: "Quanto uma presença digital organizada poderia ajudar a aumentar suas vendas?", options: ["Nada importante", "Pouco importante", "Muito importante", "Indispensável"] },
  { id: "interest", title: "Você gostaria de ser avisado caso seu negócio seja selecionado para receber um site criado por um estudante?", options: ["Sim, tenho interesse!", "Não tenho interesse no momento"] },
  { id: "contact", title: "Ótimo! Qual é seu nome e WhatsApp com DDD?", help: "Usaremos apenas para entrar em contato sobre a seleção.", kind: "text", conditional: a => a.interest === "Sim, tenho interesse!" },
];

function getStored(): ResponseRecord[] { 
  try { 
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); 
  } catch { 
    return []; 
  } 
}

function percentage(records: ResponseRecord[], audience: Audience, id: string, option: string) { 
  const group = records.filter(r => r.audience === audience && r.answers && r.answers[id]); 
  if (!group.length) return 0; 
  return Math.round(group.filter(r => r.answers[id] === option).length / group.length * 100); 
}

function makeCsv(records: ResponseRecord[]) { 
  const rows = [
    ["id", "perfil", "data", "contato_nome", "contato_whatsapp", "respostas"], 
    ...records.map(r => [
      r.id, 
      r.audience, 
      r.createdAt, 
      r.contact_name || "",
      r.contact_whatsapp || "",
      Object.entries(r.answers || {}).map(([k, v]) => `${k}: ${v}`).join(" | ")
    ])
  ]; 
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); 
}

export default function Home() {
  const [mode, setMode] = useState<"home" | "survey" | "thanks" | "admin">("home");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [records, setRecords] = useState<ResponseRecord[]>(getStored);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [adminOpen, setAdminOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Busca as respostas gravadas no Supabase
  const fetchSupabaseResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Erro ao buscar dados do Supabase:", error);
        return;
      }

      if (data) {
        const formattedRecords: ResponseRecord[] = data.map((item: any) => ({
          id: item.id,
          audience: item.audience as Audience,
          answers: item.answers || {},
          createdAt: item.created_at,
          contact_name: item.contact_name,
          contact_whatsapp: item.contact_whatsapp
        }));
        setRecords(formattedRecords);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formattedRecords));
      }
    } catch (err) {
      console.error("Erro de conexão com Supabase:", err);
    }
  };

  useEffect(() => {
    fetchSupabaseResponses();
  }, []);

  useEffect(() => { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); 
  }, [records]);

  useEffect(() => { 
    document.documentElement.classList.toggle("dark", theme === "dark"); 
  }, [theme]);

  const allQuestions = audience === "Aluno" ? studentQuestions : merchantQuestions;
  const questions = allQuestions.filter(q => !q.conditional || q.conditional(answers));
  const question = questions[step];

  function start(a: Audience) { 
    setAudience(a); 
    setAnswers({}); 
    setStep(0); 
    setMode("survey"); 
  }

  function answer(value: string) { 
    if (question) setAnswers(prev => ({ ...prev, [question.id]: value })); 
  }

  async function advance() { 
    if (!question || !answers[question.id]) return; 
    
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else { 
      setIsSubmitting(true);
      const contactText = answers["contact"] || "";
      
      // Envia para o Supabase
      try {
        const { data, error } = await supabase
          .from('survey_responses')
          .insert([
            {
              audience: audience!,
              answers: answers,
              contact_name: contactText || null,
              contact_whatsapp: contactText || null
            }
          ])
          .select();

        if (error) {
          console.error("Erro no Supabase:", error.message);
          alert(`Erro ao registrar no banco: ${error.message}`);
        } else if (data && data[0]) {
          const inserted = data[0];
          const newRecord: ResponseRecord = {
            id: inserted.id,
            audience: inserted.audience,
            answers: inserted.answers,
            createdAt: inserted.created_at,
            contact_name: inserted.contact_name,
            contact_whatsapp: inserted.contact_whatsapp
          };
          setRecords(prev => [newRecord, ...prev]);
        }
      } catch (err) {
        console.error("Erro de rede com o Supabase:", err);
      } finally {
        setIsSubmitting(false);
        setMode("thanks"); 
      }
    } 
  }

  function download() { 
    const blob = new Blob([makeCsv(records)], { type: "text/csv;charset=utf-8" }); 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement("a"); 
    link.href = url; 
    link.download = "transforme-se-respostas.csv"; 
    link.click(); 
    URL.revokeObjectURL(url); 
  }

  function enterAdmin() { 
    if (password === ADMIN_PASSWORD) { 
      setAdminOpen(false); 
      setPassword(""); 
      fetchSupabaseResponses(); // Recarrega os dados do Supabase ao logar no Admin
      setMode("admin"); 
    } 
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setMode("home")}>transforme<span>•</span></button>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button className="admin-link" onClick={() => setAdminOpen(true)}>
            <LockKeyhole size={14} /> Admin
          </button>
        </div>
      </header>

      <main>
        {mode === "home" && <HomeView onChoose={start} total={records.length} />}
        {mode === "survey" && audience && question && (
          <SurveyView 
            audience={audience} 
            question={question} 
            answers={answers} 
            records={records} 
            step={step} 
            total={questions.length} 
            isSubmitting={isSubmitting}
            onAnswer={answer} 
            onNext={advance} 
            onBack={() => step ? setStep(step - 1) : setMode("home")} 
          />
        )}
        {mode === "thanks" && audience && <ThanksView audience={audience} records={records} onRestart={() => setMode("home")} />}
        {mode === "admin" && (
          <AdminView 
            records={records} 
            onDownload={download} 
            onBack={() => setMode("home")} 
            onClear={() => { setRecords([]); localStorage.removeItem(STORAGE_KEY); setMode("home"); }} 
          />
        )}
      </main>

      <footer>
        <span className="wordmark small">transforme<span>•</span></span>
        <p>Pesquisa de validação · Transforme-se · Senac Recife</p>
        <span>2026</span>
      </footer>

      {adminOpen && (
        <div className="overlay">
          <div className="modal">
            <button className="close" onClick={() => setAdminOpen(false)}><X /></button>
            <span className="kicker">área restrita</span>
            <h2>Acesso do Admin</h2>
            <p>Entre com a senha local de demonstração.</p>
            <input 
              autoFocus 
              type="password" 
              placeholder="Senha do admin" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && enterAdmin()} 
            />
            <button className="primary full" onClick={enterAdmin}>
              entrar no painel <ArrowRight size={16} />
            </button>
            <small>somente para administradores</small>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeView({ onChoose, total }: { onChoose: (a: Audience) => void; total: number }) { 
  return (
    <section className="landing">
      <div className="hero-copy">
        <span className="kicker"><Sparkles size={13} /> pesquisa de validação · senac recife</span>
        <h1>Uma ideia fica<br /><em>mais forte</em> quando<br />a gente ouve.</h1>
        <p>Estamos validando uma iniciativa do programa Transforme-se para conectar alunos de tecnologia a pequenos negócios reais de Recife. Leva cerca de 2 minutos.</p>
        <div className="live-pill"><i /> {total} respostas já registradas</div>
      </div>
      <div className="choice-panel">
        <span className="panel-label">comece por aqui</span>
        <h2>Qual é o seu lugar<br />nessa conversa?</h2>
        <button className="choice-card student" onClick={() => onChoose("Aluno")}>
          <span className="choice-icon">A</span>
          <span><strong>Sou Aluno</strong><small>Quero construir portfólio com projetos reais.</small></span>
          <ArrowRight />
        </button>
        <button className="choice-card merchant" onClick={() => onChoose("Comerciante")}>
          <span className="choice-icon">C</span>
          <span><strong>Sou Comerciante</strong><small>Quero fortalecer a presença digital do meu negócio.</small></span>
          <ArrowRight />
        </button>
        <div className="privacy-note">Suas respostas ajudam a construir uma solução melhor.</div>
      </div>
    </section>
  ); 
}

function SurveyView({ audience, question, answers, records, step, total, isSubmitting, onAnswer, onNext, onBack }: { audience: Audience; question: Question; answers: Record<string, string>; records: ResponseRecord[]; step: number; total: number; isSubmitting: boolean; onAnswer: (v: string) => void; onNext: () => void; onBack: () => void }) { 
  const selected = answers[question.id]; 
  const options = question.options || []; 
  const progress = Math.round(((step + 1) / total) * 100); 

  return (
    <section className="survey">
      <div className="survey-meta">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={15} /> voltar</button>
        <span>fluxo {audience.toLowerCase()}</span>
        <strong>{String(step + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</strong>
      </div>
      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="question-wrap">
        <span className="kicker">pergunta obrigatória</span>
        <h1>{question.title}</h1>
        {question.help && <p className="question-help">{question.help}</p>}
        {question.kind === "text" ? (
          <input className="text-answer" autoFocus value={selected || ""} onChange={e => onAnswer(e.target.value)} placeholder="Nome completo e WhatsApp com DDD" />
        ) : (
          <div className="answers">
            {options.map(option => (
              <button key={option} className={`answer ${selected === option ? "selected" : ""}`} onClick={() => onAnswer(option)}>
                <span>{option}</span>
                <small>{selected === option ? "sua resposta" : `${percentage(records, audience, question.id, option)}% responderam isso`}</small>
                <i>{selected === option && <Check size={15} />}</i>
              </button>
            ))}
          </div>
        )}
        <div className="question-footer">
          <span>{selected ? "Resposta selecionada" : "Escolha uma opção para continuar"}</span>
          <button className="primary" disabled={!selected || isSubmitting} onClick={onNext}>
            {isSubmitting ? "enviando..." : step === total - 1 ? "finalizar" : "continuar"} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  ); 
}

function ThanksView({ audience, records, onRestart }: { audience: Audience; records: ResponseRecord[]; onRestart: () => void }) { 
  const mine = records.filter(r => r.audience === audience).length; 
  const other = records.filter(r => r.audience !== audience).length; 
  return (
    <section className="thanks">
      <div className="thanks-mark"><Check size={30} /></div>
      <span className="kicker">resposta recebida</span>
      <h1>Obrigado por<br /><em>construir com a gente.</em></h1>
      <p>Sua resposta já faz parte da validação do Transforme-se. Quanto mais pessoas participarem, mais clara fica a oportunidade.</p>
      <div className="summary">
        <div><strong>{mine}</strong><span>no seu grupo</span></div>
        <div><strong>{other}</strong><span>no outro grupo</span></div>
        <div><strong>{records.length}</strong><span>total</span></div>
      </div>
      <button className="primary" onClick={onRestart}>voltar ao início <ArrowRight size={16} /></button>
    </section>
  ); 
}

const adminQuestionCatalog: { audience: Audience; id: string; title: string; options: string[] }[] = [
  { audience: "Aluno", id: "program", title: "Você faz parte do programa Transforme-se?", options: ["Sim", "Não"] },
  { audience: "Aluno", id: "class", title: "Turma do Transforme-se", options: ["Turma de Ruth", "Turma de Carrasco", "Turma Anicely", "Turma Radássila", "Outra"] },
  { audience: "Aluno", id: "study", title: "Tempo de estudo em tecnologia", options: ["Entre 1 a 4 meses", "Entre 5 a 8 meses", "Mais de 9 meses"] },
  { audience: "Aluno", id: "real", title: "Já fez projeto real fora do curso?", options: ["Sim", "Não"] },
  { audience: "Aluno", id: "portfolio", title: "O que mais falta no portfólio", options: ["Projetos para clientes reais", "Projetos publicados no ar", "Feedback de alguém da área", "Ainda não sei", "Outro"] },
  { audience: "Aluno", id: "volunteer", title: "Faria projeto voluntário ou simbólico?", options: ["Sim", "Talvez", "Não"] },
  { audience: "Aluno", id: "hours", title: "Horas semanais disponíveis", options: ["Até 2h", "2h a 5h", "Mais de 5h"] },
  { audience: "Aluno", id: "delivery", title: "Preferência para entrega", options: ["Confortável direto", "Prefiro que revisem antes"] },
  { audience: "Comerciante", id: "business", title: "Tipo de negócio", options: ["Padaria", "Salão/Barbearia", "Costura/Confecção", "Alimentação", "Comércio em geral", "Outro"] },
  { audience: "Comerciante", id: "internet", title: "Situação atual na internet", options: ["Não tenho site", "Tenho página simples de links/catálogo", "Já tenho site profissional"] },
  { audience: "Comerciante", id: "barrier", title: "Principal impedimento para ter site", options: ["Acho caro ou complicado", "Falta tempo para organizar conteúdo", "Não encontro profissional de confiança"] },
  { audience: "Comerciante", id: "results", title: "Resultados do site atual", options: ["Sim", "Não, precisa ser atualizado", "Não sei medir"] },
  { audience: "Comerciante", id: "trust", title: "Confiança em presença digital", options: ["Sim, já sabia", "Não sabia", "Concordo totalmente"] },
  { audience: "Comerciante", id: "whatsapp", title: "Tempo gasto no WhatsApp", options: ["Muito tempo! Atrapalha a rotina", "Um tempo razoável", "Pouco tempo"] },
  { audience: "Comerciante", id: "condition", title: "Condição para aceitar o site", options: ["Aceitaria imediatamente", "Com supervisão de professor/profissional", "Vendo trabalhos anteriores", "Com prazo garantido"] },
  { audience: "Comerciante", id: "price", title: "Valor imaginado para um site", options: ["Até R$ 100", "Entre R$ 100 e R$ 300", "Entre R$ 300 e R$ 800", "Acima de R$ 800", "Não faço ideia"] },
  { audience: "Comerciante", id: "impact", title: "Impacto esperado nas vendas", options: ["Nada importante", "Pouco importante", "Muito importante", "Indispensável"] },
  { audience: "Comerciante", id: "interest", title: "Interesse em receber contato", options: ["Sim, tenho interesse!", "Não tenho interesse no momento"] },
];

function AdminView({ records, onDownload, onBack, onClear }: { records: ResponseRecord[]; onDownload: () => void; onBack: () => void; onClear: () => void }) { 
  const students = records.filter(r => r.audience === "Aluno"); 
  const merchants = records.filter(r => r.audience === "Comerciante"); 
  const interested = merchants.filter(r => r.answers?.interest === "Sim, tenho interesse!"); 

  const top = (group: ResponseRecord[], id: string) => { 
    const counts: Record<string, number> = {}; 
    group.forEach(r => { 
      const value = r.answers?.[id]; 
      if (value) counts[value] = (counts[value] || 0) + 1; 
    }); 
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"; 
  }; 

  return (
    <section className="admin-page">
      <div className="admin-head">
        <div>
          <span className="kicker"><BarChart3 size={13} /> visão geral</span>
          <h1>O que a rede<br /><em>está dizendo.</em></h1>
        </div>
        <div className="admin-actions">
          <button className="secondary" onClick={onBack}>voltar</button>
          <button className="primary" onClick={onDownload}><Download size={15} /> exportar CSV</button>
        </div>
      </div>
      <div className="metrics">
        <Metric value={records.length} label="respostas totais" />
        <Metric value={students.length} label="alunos" />
        <Metric value={merchants.length} label="comerciantes" />
        <Metric value={interested.length} label="interessados em contato" />
      </div>
      <div className="admin-grid">
        <div className="data-card">
          <span className="kicker">sinal mais forte</span>
          <h2>Respostas em destaque</h2>
          <div className="signal"><span>Alunos · portfólio</span><strong>{top(students, "portfolio")}</strong></div>
          <div className="signal"><span>Comerciantes · presença digital</span><strong>{top(merchants, "internet")}</strong></div>
          <div className="signal"><span>Comerciantes · interesse</span><strong>{top(merchants, "interest")}</strong></div>
        </div>
        <div className="data-card">
          <div className="card-head">
            <div><span className="kicker">contatos</span><h2>Comerciantes interessados</h2></div>
            <span className="count-badge">{interested.length}</span>
          </div>
          {interested.length ? interested.map(r => {
            const contactInfo = r.contact_name || r.answers?.contact || "Contato não informado";
            return (
              <div className="contact-row" key={r.id}>
                <span className="avatar">{contactInfo.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{contactInfo}</strong>
                  <small>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</small>
                </div>
              </div>
            );
          }) : <p className="empty">Ainda não há contatos interessados.</p>}
        </div>
      </div>
      <div className="charts-section">
        <div className="charts-heading">
          <div><span className="kicker"><BarChart3 size={13} /> leitura pergunta a pergunta</span><h2>Como cada grupo respondeu</h2></div>
          <p>As barras mostram a distribuição percentual dentro do grupo, usando somente respostas já registradas.</p>
        </div>
        <div className="charts-grid">
          {adminQuestionCatalog.map(item => (
            <QuestionChart key={`${item.audience}-${item.id}`} item={item} records={item.audience === "Aluno" ? students : merchants} />
          ))}
        </div>
      </div>
      <button className="danger-link" onClick={onClear}>limpar respostas locais da demonstração</button>
    </section>
  ); 
}

function QuestionChart({ item, records }: { item: { audience: Audience; id: string; title: string; options: string[] }; records: ResponseRecord[] }) { 
  const answered = records.filter(r => r.answers && r.answers[item.id]); 
  const counts = item.options.map(option => ({ option, count: answered.filter(r => r.answers[item.id] === option).length })); 
  const max = Math.max(...counts.map(row => row.count), 1); 

  return (
    <article className="question-chart">
      <div className="chart-top">
        <span className={`chart-audience ${item.audience === "Aluno" ? "student-label" : "merchant-label"}`}>{item.audience}</span>
        <span className="chart-total">{answered.length} resposta{answered.length === 1 ? "" : "s"}</span>
      </div>
      <h3>{item.title}</h3>
      {counts.map(row => (
        <div className="bar-row" key={row.option}>
          <div className="bar-label">
            <span title={row.option}>{row.option}</span>
            <strong>{answered.length ? Math.round(row.count / answered.length * 100) : 0}%</strong>
          </div>
          <div className="bar-track">
            <i style={{ width: `${answered.length ? row.count / max * 100 : 0}%` }} />
            <small>{row.count}</small>
          </div>
        </div>
      ))}
    </article>
  ); 
}

function Metric({ value, label }: { value: number; label: string }) { 
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  ); 
}