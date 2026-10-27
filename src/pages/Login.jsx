import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../services/api';

function Login() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const navigate = useNavigate();

  const fazerLogin = async (evento) => {
    evento.preventDefault();

    try {
      const resposta = await fetch(BASE_URL + '/api/login', {
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

        if (dados.perfil === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/caixa');
        }
        
      } else {
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