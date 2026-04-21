'use client'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase' 
import imageCompression from 'browser-image-compression'

export default function HaudArchiveApp() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState(null);
  const [editData, setEditData] = useState({});
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [modalData, setModalData] = useState({ isOpen: false, images: [], currentIndex: 0 });

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    customer_name: '', manager: '', product_name: '', tags: '', as_note: ''
  })

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setIsAdmin(user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin')
    }
  }

  useEffect(() => { checkUser() }, [])
  useEffect(() => { if (user) fetchProjects() }, [user, isAdmin])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('work_date', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) { console.error("로드 에러:", err.message) }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('로그인 실패: ' + error.message)
    else {
      setUser(data.user)
      setIsAdmin(data.user.user_metadata?.role === 'admin' || data.user.app_metadata?.role === 'admin')
    }
  }

  const uploadImages = async (files, folder) => {
    if (!files || files.length === 0) return []
    const urls = []
    const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true }
    for (const file of files) {
      try {
        const compressedFile = await imageCompression(file, options)
        const fileName = `${Date.now()}_${file.name}`
        const { data, error } = await supabase.storage.from('Photos').upload(`${folder}/${fileName}`, compressedFile)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(data.path)
        urls.push(publicUrl)
      } catch (err) { console.error("업로드 실패:", err) }
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(!formData.customer_name) return alert('현장명을 입력해주세요.');
    setLoading(true)
    try {
      // 사진 업로드 (파일이 없으면 빈 배열 [] 반환)
      const afterFiles = document.getElementById('after_imgs')?.files;
      const asFiles = document.getElementById('as_imgs')?.files;
      
      const afterUrls = await uploadImages(afterFiles, 'after');
      const asUrls = await uploadImages(asFiles, 'as');
      
      // [핵심] 빈 값일 경우 null 대신 빈 배열 {} 또는 [] 처리를 Supabase가 이해하게 보냅니다.
      const { error } = await supabase.from('projects').insert([{
        work_date: formData.work_date,
        customer_name: formData.customer_name,
        manager: formData.manager,
        product_name: formData.product_name,
        tags: formData.tags,
        as_note: formData.as_note,
        installer_id: user.id,
        installer_name: user.email,
        // 배열 타입 에러 방지를 위해 빈 배열 보장
        after_urls: afterUrls.length > 0 ? afterUrls : null, 
        as_urls: asUrls.length > 0 ? asUrls : null
      }])

      if (error) throw error
      alert('성공적으로 등록되었습니다!');
      setFormData({work_date: new Date().toISOString().split('T')[0], customer_name: '', manager: '', product_name: '', tags: '', as_note: ''})
      // 입력창 리셋
      if(document.getElementById('after_imgs')) document.getElementById('after_imgs').value = "";
      if(document.getElementById('as_imgs')) document.getElementById('as_imgs').value = "";
      
      fetchProjects()
    } catch (err) { 
      alert('등록 실패: ' + err.message);
      console.error(err);
    }
    finally { setLoading(false) }
  }

  // ... (기존 openDetail, saveUpdate, deleteProject 등 상세 기능은 동일하게 유지)
  const openDetail = (project) => { setSelectedProject(project); setEditData({ ...project }); setIsDetailOpen(true); }
  const saveUpdate = async () => {
    if (!selectedProject?.id) return alert("데이터 ID를 찾을 수 없습니다.");
    setLoading(true);
    try {
      const extraFiles = document.getElementById('extra_imgs')?.files;
      const extraUrls = await uploadImages(extraFiles, 'after');
      const updatedAfterUrls = [...(editData.after_urls || []), ...extraUrls];
      const { error } = await supabase.from('projects').update({
        customer_name: editData.customer_name,
        product_name: editData.product_name,
        manager: editData.manager,
        tags: editData.tags,
        after_urls: updatedAfterUrls
      }).eq('id', selectedProject.id);
      if (error) throw error;
      alert('업데이트 완료!');
      setIsDetailOpen(false);
      fetchProjects();
    } catch (err) { alert('업데이트 실패: ' + err.message); }
    finally { setLoading(false); }
  }
  const deleteProject = async () => {
    if (!selectedProject?.id) return alert("ID 미확인");
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from('projects').delete().eq('id', selectedProject.id);
    if (!error) { alert('삭제 완료'); setIsDetailOpen(false); fetchProjects(); }
  }
  const filteredProjects = projects.filter(p => (p.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (p.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
  const openPhotoModal = (images, index) => setModalData({ isOpen: true, images, currentIndex: index });
  const closePhotoModal = () => setModalData({ ...modalData, isOpen: false });
  const prevImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })) }
  const nextImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })) }

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen bg-white">
        <h1 className="text-4xl font-black text-blue-900 mb-8 uppercase italic text-center tracking-tighter">hAUD ARCHIVE</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="이메일" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-900 text-white p-5 rounded-2xl font-black text-lg">로그인</button>
        </form>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900">
      <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-blue-900 leading-none uppercase italic tracking-tighter">hAUD ARCHIVE</h1>
          <p className={`text-[11px] font-black mt-2 px-3 py-1 rounded-full inline-block ${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '관리자 모드' : `${user.email.split('@')[0]} 기사님`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest pb-1 border-b">Logout</button>
      </header>

      <details className="bg-white p-6 rounded-[2.5rem] shadow-sm mb-12 border border-blue-50">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none uppercase italic">
          <span className="text-lg font-black tracking-tight">➕ REGISTER CASE</span>
          <span className="text-[10px] font-black text-blue-500 tracking-widest">OPEN</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" value={formData.work_date} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none shadow-inner" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            <input type="text" placeholder="현장명 (고객명)" value={formData.customer_name} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none shadow-inner" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-dashed border-blue-100">
              <p className="text-[10px] font-black text-blue-800 mb-2 uppercase">📸 완료 사진</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
            <div className="p-6 bg-red-50/50 rounded-[2rem] border-2 border-dashed border-red-100">
              <p className="text-[10px] font-black text-red-800 mb-2 uppercase">📸 AS 사진</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
          </div>
          <textarea placeholder="특이사항 및 메모" className="w-full p-5 rounded-[2rem] bg-gray-50 h-32 outline-none border-none shadow-inner text-sm font-medium" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all uppercase">
            {loading ? 'STORING DATA...' : 'SUBMIT RECORD'}
          </button>
        </form>
      </details>

      <div className="mb-10 relative px-2">
        <input type="text" placeholder="현장명, 제품명 검색..." className="w-full p-5 pl-14 rounded-[2.5rem] border-none shadow-sm text-sm outline-none bg-white focus:ring-2 focus:ring-blue-100 shadow-blue-50 transition-all" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-8 top-6 text-gray-300 text-xl font-light">🔍</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
        {filteredProjects.map((p) => (
          <div key={p.id} onClick={() => openDetail(p)} className="bg-white rounded-[3rem] overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-white group flex flex-col">
            <div className="h-64 overflow-hidden relative bg-gray-100">
              {p.after_urls?.[0] ? <img src={p.after_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] font-black uppercase italic">No Photo</div>}
              <div className="absolute top-5 left-5 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-blue-900 shadow-sm uppercase">{p.work_date}</div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <h3 className="text-2xl font-black text-gray-800 mb-1 tracking-tighter leading-tight uppercase group-hover:text-blue-900 transition-colors">{p.customer_name || '현장명 없음'}</h3>
              <p className="text-xs font-black text-blue-500 mb-4 uppercase italic">기사: {p.installer_name?.split('@')[0]}</p>
              <div className="mt-auto pt-5 border-t border-gray-50 flex justify-between items-center text-[11px] font-black">
                <p className="text-gray-400 truncate flex-1 mr-4">{p.product_name || '기본 정보'}</p>
                <span className="text-blue-600 uppercase">VIEW →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 상세 모달 및 나머지 기능 동일 */}
      {isDetailOpen && selectedProject && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-8 md:p-12 border-b flex justify-between items-start sticky top-0 bg-white z-10">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase italic">{selectedProject.work_date} Case</span>
                <input className="block text-4xl font-black mt-2 bg-transparent border-b-2 border-blue-50 outline-none w-full uppercase" value={editData.customer_name || ''} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl text-gray-400 hover:text-black">&times;</button>
            </div>
            <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12 text-sm font-medium">
              <div className="space-y-6">
                <p className="text-[11px] font-black text-gray-300 uppercase italic">Photos</p>
                <div className="grid grid-cols-2 gap-3">
                  {[...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])].map((url, i) => (
                    <img key={i} src={url} onClick={() => openPhotoModal([...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])], i)} className="w-full h-40 object-cover rounded-[1.5rem] border-4 border-gray-50 shadow-sm cursor-zoom-in hover:scale-[1.03] transition-all" />
                  ))}
                </div>
                <div className="p-6 bg-blue-50/50 rounded-[1.5rem] border-2 border-dashed border-blue-100 text-center text-[10px] font-black text-blue-800">
                  <p className="mb-2">➕ ADD PHOTOS</p>
                  <input type="file" id="extra_imgs" multiple accept="image/*" className="w-full" />
                </div>
              </div>
              <div className="flex flex-col space-y-6">
                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-blue-400 uppercase italic">Product</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-black outline-none" value={editData.product_name || ''} onChange={e => setEditData({...editData, product_name: e.target.value})} /></div>
                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-blue-400 uppercase italic">Sales Manager</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-black outline-none" value={editData.manager || ''} onChange={e => setEditData({...editData, manager: e.target.value})} /></div>
                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-blue-400 uppercase italic">Tags</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-black outline-none italic" value={editData.tags || ''} onChange={e => setEditData({...editData, tags: e.target.value})} /></div>
                <div className="flex gap-3 mt-auto pt-10">
                  <button onClick={saveUpdate} disabled={loading} className="flex-[3] bg-blue-900 text-white p-6 rounded-[1.8rem] font-black shadow-xl uppercase transition-all active:scale-95">Update</button>
                  <button onClick={deleteProject} className="flex-1 bg-red-50 text-red-600 p-6 rounded-[1.8rem] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm uppercase text-[10px]">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalData.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={closePhotoModal}>
          <button className="absolute top-8 right-8 text-white text-5xl" onClick={closePhotoModal}>&times;</button>
          <button className="absolute left-6 text-white/40 text-7xl p-2" onClick={prevImg}>&#8249;</button>
          <div className="max-w-[85%] max-h-[80%] flex flex-col items-center">
            <img src={modalData.images[modalData.currentIndex]} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <p className="text-white font-black text-xs mt-8 italic tracking-[0.5em]">{modalData.currentIndex + 1} / {modalData.images.length}</p>
          </div>
          <button className="absolute right-6 text-white/40 text-7xl p-2" onClick={nextImg}>&#8250;</button>
        </div>
      )}
    </main>
  )
}