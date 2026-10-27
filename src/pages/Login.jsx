import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  // Estados para guardar o que o usuário digita nos campos
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
 
  
  // Hook do React Router para fazer o redirecionamento de página
  const navigate = useNavigate();

  // Função disparada ao clicar em "Entrar"
  const fazerLogin = async (evento) => {
    evento.preventDefault();

    try {
      const resposta = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha })
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        
        const nomeDoUsuario = dados.nomeCompleto || dados.nome || 'Usuário';

        localStorage.setItem('token', dados.token);
        localStorage.setItem('perfil', dados.perfil);
        localStorage.setItem('nome', nomeDoUsuario);

        // Alerta de sucesso removido! O redirecionamento acontece direto.
        if (dados.perfil === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/caixa');
        }
        
      } else {
        // Alertas de erro mantidos
        alert('CPF ou senha incorretos! Tente novamente.');
      }
    } catch (erro) {
      alert('Erro de conexão. Verifique se o back-end está rodando.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>Nexo Gestão</h1>
      <p>Acesse sua conta</p>

      <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
        <input 
          type="text" 
          placeholder="Digite seu CPF" 
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        
        <input 
          type="password" 
          placeholder="Digite sua senha" 
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        
        <button 
          type="submit" 
          style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Entrar
        </button>
      </form>
    </div>
  );
}

export default Login;