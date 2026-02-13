import React, { useState, useEffect } from 'react';
import { fetchOdooData } from './services/odooService';
import { 
  BarChart3, Users, UserSquare2, Unlink, 
  ArrowUpRight, Loader2, Menu, X, Bus, Scan, ShieldCheck
} from 'lucide-react';

const NFCBindingView = () => {
  const [alumnosSinNFC, setAlumnosSinNFC] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlumnos = async () => {
      setLoading(true);
      const result = await fetchOdooData('gestion_entrada.alumno', ["uid", "name", "surname", "school_year"]);
      setAlumnosSinNFC(result.filter(a => !a.uid));
      setLoading(false);
    };
    loadAlumnos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg shadow-blue-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Modo Emparejamiento</h2>
          <p className="text-blue-100 text-sm max-w-md">Selecciona un alumno y acerca la tarjeta NFC al lector para vincularla.</p>
        </div>
        <div className="bg-white/20 p-4 rounded-full animate-pulse text-white">
          <Scan size={48} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-slate-900">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold text-slate-700">Alumnos pendientes</h3>
        </div>
        <div className="divide-y divide-slate-50 text-slate-900">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : alumnosSinNFC.length > 0 ? (
            alumnosSinNFC.map((alum, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-bold text-slate-800">{alum.name} {alum.surname}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">{alum.school_year}</p>
                </div>
                <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">
                  Vincular
                </button>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-slate-400">Sin alumnos pendientes.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickPermissions = () => {
  const [alumnos, setAlumnos] = useState([]);

  useEffect(() => {
    const loadAlumnos = async () => {
      const result = await fetchOdooData('gestion_entrada.alumno', ["uid", "name", "surname", "school_year"]);
      setAlumnos(result.slice(0, 5)); 
    };
    loadAlumnos();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8 text-slate-900">
      <div className="p-5 border-b border-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Gestión Rápida de Permisos</h3>
        <button className="text-[10px] bg-slate-100 px-3 py-1 rounded-md font-bold text-slate-500 uppercase">Filtrar</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[600px]">
          <thead className="text-slate-400 text-[10px] uppercase font-bold bg-slate-50/50">
            <tr>
              <th className="px-6 py-3">Alumno/a</th>
              <th className="px-6 py-3">Curso</th>
              <th className="px-6 py-3">UID/NFC</th>
              <th className="px-6 py-3 text-right">Salir Recreo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {alumnos.map((alum, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-bold text-slate-700">{alum.name} {alum.surname}</td>
                <td className="px-6 py-4 text-slate-500">{alum.school_year}</td>
                <td className={`px-6 py-4 font-mono text-xs ${alum.uid ? 'text-blue-600 font-bold' : 'text-red-400 italic'}`}>
                  {alum.uid || 'Sin vincular'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`inline-block w-10 h-5 rounded-full relative shadow-inner cursor-pointer transition-colors ${alum.uid ? 'bg-green-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${alum.uid ? 'right-1' : 'left-1'}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DashboardHome = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Salidas Hoy" value="142" trend="+12%" />
      <StatCard title="Incidencias" value="3" color="red" />
      <StatCard title="Activos" value="98%" />
    </div>
    
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-slate-900">
      <div className="flex items-center gap-2 mb-10 text-sm font-bold text-slate-700">
        <ArrowUpRight size={18} className="text-blue-600" /> Salidas Anticipadas (Semana actual)
      </div>
      <div className="flex items-end justify-around h-64 gap-3 text-slate-900">
        {[65, 45, 85, 55, 30].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
            <div className="w-full max-w-[50px] bg-slate-50 rounded-lg h-full flex items-end overflow-hidden border border-slate-100">
              <div className="w-full bg-blue-600 hover:bg-blue-500 transition-all rounded-t-sm" style={{ height: `${h}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              {['Lunes', 'Martes', 'Miérc', 'Jueves', 'Viernes'][i]}
            </span>
          </div>
        ))}
      </div>
    </div>

    <QuickPermissions />
  </div>
);


export default function Dashboard({ user, onLogout }) {
  const [view, setView] = useState(user.is_management ? 'dashboard' : 'guardia');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {}
      {user.is_management && (
        <>
          {}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          
          <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 p-6 flex flex-col transition-transform duration-300 transform lg:translate-x-0 lg:static lg:h-screen lg:sticky lg:top-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center gap-3 mb-12 px-2">
              <div className="bg-blue-700 p-2 rounded-lg text-white shadow-lg"><BarChart3 size={24} /></div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight tracking-tighter">
                Panel de Jefatura<br/>
                <span className="text-blue-700 lowcase tracking-tighter">IES San Juan de la rambla</span>
              </h1>
            </div>
            
            <nav className="space-y-1 flex-1">
              <SidebarItem icon={BarChart3} label="Estadísticas" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Users} label="Alumnado" active={view === 'alumnado'} onClick={() => { setView('alumnado'); setIsSidebarOpen(false); }} />
              <SidebarItem icon={UserSquare2} label="Profesorado" active={view === 'profesorado'} onClick={() => { setView('profesorado'); setIsSidebarOpen(false); }} />
              <SidebarItem icon={Unlink} label="Vinculación NFC" active={view === 'nfc'} onClick={() => { setView('nfc'); setIsSidebarOpen(false); }} />
              <SidebarItem icon={ShieldCheck} label="Control Guardia" active={view === 'guardia'} onClick={() => { setView('guardia'); setIsSidebarOpen(false); }} />
            </nav>
            
            <div className="mt-auto p-4 bg-slate-50 rounded-2xl flex flex-col gap-1 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase truncate mb-1">Equipo Directivo</p>
              <p className="text-sm font-bold text-slate-700 truncate">{user.name} {user.surname}</p>
              <button onClick={onLogout} className="text-xs font-black text-red-500 hover:text-red-700 text-left mt-1">Cerrar Sesión</button>
            </div>
          </aside>
        </>
      )}

      {}
      <main className={`flex-1 p-6 md:p-10 overflow-y-auto w-full text-slate-900 ${!user.is_management ? 'flex items-center justify-center' : ''}`}>
        
        {}
        <header className={`flex justify-between items-center mb-8 ${!user.is_management ? 'fixed top-10 left-10 right-10' : ''}`}>
          <div>
            <h2 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">IES San Juan de la Rambla</h2>
            <h1 className="text-3xl font-black text-slate-800 capitalize">
                {view === 'guardia' ? 'Control de Guardia' : view}
            </h1>
          </div>
           
          {}
          {user.is_management && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="lg:hidden p-2 bg-white border border-slate-200 rounded-xl shadow-sm"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </header>
        
        {}
        {view === 'dashboard' && <DashboardHome />}
        {view === 'alumnado' && <ListView title="Gestión de Alumnado" type="alumnado" />}
        {view === 'profesorado' && <ListView title="Cuerpo Docente" type="profesorado" />}
        {view === 'nfc' && <NFCBindingView />}
        
        {}
        {view === 'guardia' && (
          <div className={`flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 ${!user.is_management ? 'max-w-xl w-full shadow-lg shadow-slate-200/50' : ''}`}>
            <h1 className="text-6xl font-black text-slate-800">Hola Mundo</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-4">
               {user.is_management ? "Sección de Control para Directiva" : "Usted está en la sección de Guardia"}
            </p>

            {}
            {!user.is_management && (
              <div className="mt-10 pt-8 border-t border-slate-100 w-full text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Profesorado</p>
                <p className="text-lg font-bold text-slate-700">{user.name} {user.surname}</p>
                <button 
                  onClick={onLogout} 
                  className="mt-6 text-sm font-black text-red-500 hover:text-red-700 uppercase tracking-tighter"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const ListView = ({ title, type }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const isAlumnado = type === 'alumnado';
      const model = isAlumnado ? 'gestion_entrada.alumno' : 'gestion_entrada.profesor'; 
      const fields = isAlumnado ? ["uid", "name", "surname", "email", "school_year", "can_bus"] : ["uid", "name", "surname", "email"]; 
      try {
        const result = await fetchOdooData(model, fields);
        setData(result);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadData();
  }, [type]);

  if (loading) return <div className="p-10 flex justify-center text-blue-600"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-slate-900">
      <div className="p-6 border-b border-slate-50 flex justify-between items-center text-slate-900">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{data.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
            <tr>
              <th className="px-6 py-4">ID NFC</th>
              <th className="px-6 py-4">Nombre</th>
              {type === 'alumnado' && <th className="px-6 py-4">Curso</th>}
              {type === 'alumnado' && <th className="px-6 py-4">Bus</th>}
              <th className="px-6 py-4 text-right">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {data.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold uppercase">{item.uid || '---'}</td>
                <td className="px-6 py-4 font-bold text-slate-700">{item.name} {item.surname}</td>
                {type === 'alumnado' && <td className="px-6 py-4 text-slate-500">{item.school_year}</td>}
                {type === 'alumnado' && <td className="px-6 py-4 flex items-center gap-2">
                  {item.can_bus ? <Bus size={18} className="text-green-500" /> : <Bus size={18} className="text-red-500" />}
                  <span className={item.can_bus ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{item.can_bus ? 'Si' : 'No'}</span>
                </td>}
                <td className="px-6 py-4 text-right text-slate-400">{item.email || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, trend, color = "blue" }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-slate-900">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
    <div className="flex items-baseline gap-2 mt-2">
      <h3 className={`text-3xl font-black ${color === 'red' ? 'text-red-500' : 'text-slate-800'}`}>{value}</h3>
      {trend && <span className="text-xs font-bold text-green-500">{trend}</span>}
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-50 text-blue-700 font-bold shadow-sm shadow-blue-100/50' : 'text-slate-500 hover:bg-slate-100'}`}
  >
    <Icon size={20}/> 
    <span className="text-sm tracking-tight">{label}</span>
  </button>
);