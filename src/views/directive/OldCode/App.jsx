import React, { useState } from 'react';
import { loginToOdoo } from './services/LogInService';
import Dashboard from './Dashboard'; 
import { Loader2, Lock, User, BarChart3 } from 'lucide-react';

export default function App() {
    const [user, setUser] = useState(null); 
    const [username, setUsername] = useState(''); 
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
  
    const handleLogin = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');
  
      const professorData = await loginToOdoo(username, password);
  
      if (professorData) {
        setUser(professorData);
      } else {
        setError('Usuario o contraseña no válidos');
      }
      setLoading(false);
    };
  
    if (!user) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
            <div className="flex flex-col items-center mb-8">
              <div className="bg-blue-700 p-3 rounded-2xl text-white mb-4 shadow-lg shadow-blue-100">
                <BarChart3 size={32} />
              </div>
              <h1 className="text-2xl font-black text-slate-800">Panel de Jefatura</h1>
              <p className="text-slate-400 text-sm font-medium">IES San Juan de la Rambla</p>
            </div>
  
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-300" size={18} />
                <input 
                  type="text"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Usuario"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-300" size={18} />
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg">{error}</p>}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-700 text-white font-bold py-3 rounded-xl hover:bg-blue-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      );
    }
  
    return <Dashboard user={user} onLogout={() => setUser(null)} />;
}