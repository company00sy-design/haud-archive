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
  
  // 수정 중인 데이터와 ID를 따로 관리
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  
  const [modalData, setModalData] = useState({ isOpen: false, images: [], currentIndex: 0 })

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    customer_name: '', manager: '', product_name: '', tags: '', as_note: ''
  })

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      const role = user.user_metadata?.role || user.app_metadata?.role
      setIsAdmin(role === 'admin')
    }
  }

  useEffect(() => { checkUser() }, [])
  useEffect(() => { if (user) fetchProjects() }, [user, isAdmin])

  const fetchProjects = async () => {
    try {
      let query = supabase.from('projects').select('*').order('work_date', { ascending: false })
      if (!isAdmin) query = query.eq('installer_id', user.id)
      const { data, error } = await query
      if (!error) setProjects(data || [])
    } catch (err) { console.error(err) }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('로그인 실패')
    else {
      setUser(data.user)
      const role = data.user.user_metadata?.role || data.user.app_metadata?.role
      setIsAdmin(role === 'admin')
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
        const { data } = await supabase.storage.from('Photos').upload(`${folder}/${fileName}`, compressedFile)
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(data.path)
          urls.push(publicUrl)
        }
      } catch (err) { console.error(err) }
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(!formData.customer_name) return alert('고객명을 입력해주세요.');
    setLoading(true)
    try {
      const afterUrls = await uploadImages(document.getElementById('after_imgs')?.files, 'after')
      const asUrls = await uploadImages(document.getElementById('as_imgs')?.files, 'as')
      const { error } = await supabase.from('projects').insert([{
        ...formData,
        installer_id: user.id,
        installer_name: user.email,
        after_urls: afterUrls,
        as_urls: asUrls
      }])
      if (error) throw error
      alert('등록 완료!')
      setFormData({work_date: new Date().toISOString().split('T')[0], customer_name: '', manager: '', product_name: '', tags: '', as_note: ''})
      fetchProjects()
    } catch (err) { alert('등록 실패') }
    finally { setLoading(false) }
  }

  // [수정 핵심] 수정 버튼을 눌렀을 때만 해당 카드의 데이터를 복사해옵니다.
  const startEdit = (project) => {
    setEditingId(project.id);
    setEditData({ ...project });
  }

  const saveEdit = async () => {
    const { error } = await supabase.from('projects').update(editData).eq('id', editingId)
    if (!error) {
      alert('업데이트 성공!');
      setEditingId(null);
      fetchProjects();
    }
  }

  const openModal = (images, index) => setModalData({ isOpen: true, images, currentIndex: index })
  const closeModal = () => setModalData({ isOpen: false, images: [], currentIndex: 0 })
  const prevImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })) }
  const nextImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })) }

  const filteredProjects = projects.filter(p => 
    (p.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.manager || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen">
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
    <main className="max-w-6xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900 transition-all">
      <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-100 px-2">
        <div>
          <h1 className="text-3xl font-black text-blue-900 leading-none uppercase italic tracking-tighter">hAUD ARCHIVE</h1>
          <p className={`text-[11px] font-black mt-2 px-3 py-1 rounded-full inline-block ${isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '내근직원(관리자) 모드' : `${user.email.split('@')[0]} 기사님 모드`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest pb-1 border-b">Logout</button>
      </header>

      {/* 시공 등록 섹션 */}
      <details className="bg-white p-6 rounded-[2.5rem] shadow-xl mb-12 border-2 border-blue-50 overflow-hidden mx-2">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <span className="text-lg font-black tracking-tight">새 시공 기록 등록</span>
          </div>
          <span className="bg-blue-50 px-4 py-2 rounded-full text-blue-900 text-[10px] font-black uppercase tracking-widest">Open</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" value={formData.work_date} className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            <input type="text" placeholder="고객명 (현장명)" value={formData.customer_name} className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-dashed border-blue-100">
              <p className="text-[11px] font-black text-blue-800 mb-3 uppercase">📸 완료 사진 (필수)</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
            <div className="p-6 bg-red-50/50 rounded-[2rem] border-2 border-dashed border-red-100">
              <p className="text-[11px] font-black text-red-800 mb-3 uppercase">📸 AS 사진 (선택)</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
          </div>
          <textarea placeholder="기사님 전달사항 / AS 메모" className="w-full p-5 border-none rounded-[2rem] bg-gray-50 h-32 outline-none text-sm" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all">
            {loading ? '기록 중...' : '시공 데이터 기록 완료'}
          </button>
        </form>
      </details>

      {/* 검색 바 */}
      <div className="mb-12 relative px-2">
        <input type="text" placeholder="고객명, 제품명, 담당자 이름 검색..." className="w-full p-5 pl-12 rounded-[2rem] border-none shadow-sm text-sm outline-none bg-white" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-6 top-5 text-gray-300">🔍</span>
      </div>

      {/* 리스트 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2 items-stretch">
        {filteredProjects.map((p) => {
          const isEditing = editingId === p.id;
          const allImages = [...(p.after_urls || []), ...(p.as_urls || [])];
          return (
            <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-white flex flex-col h-full group hover:shadow-xl transition-all relative">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-blue-300 tracking-widest uppercase">{p.work_date}</span>
                  {isEditing ? (
                    <input className="w-full text-2xl font-black mt-1 p-2 bg-blue-50/50 border-b-2 border-blue-600 outline-none rounded" value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
                  ) : (
                    <h3 className="font-black text-gray-900 text-2xl mt-1 tracking-tighter group-hover:text-blue-900 transition-colors uppercase">{p.customer_name || '미등록 현장'}</h3>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                     <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">영업: {p.manager || '미지정'}</span>
                     <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-blue-100">기사: {p.installer_name?.split('@')[0]}</span>
                  </div>
                </div>
                {isAdmin && !isEditing && (
                  <button onClick={() => startEdit(p)} className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-all">EDIT</button>
                )}
              </div>

              {/* [수정 섹션] 수정 모드일 때만 보입니다 */}
              {isEditing ? (
                <div className="space-y-3 my-4 p-5 bg-blue-50/30 rounded-[2rem] border border-blue-100">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-1 mb-2">사무실 전용 입력란</p>
                  <input placeholder="제품명" className="w-full p-4 bg-white rounded-2xl text-sm border-none shadow-sm font-bold" value={editData.product_name || ''} onChange={e => setEditData({...editData, product_name: e.target.value})} />
                  <input placeholder="영업 담당자" className="w-full p-4 bg-white rounded-2xl text-sm border-none shadow-sm font-bold" value={editData.manager || ''} onChange={e => setEditData({...editData, manager: e.target.value})} />
                  <input placeholder="태그 (쉼표 구분)" className="w-full p-4 bg-white rounded-2xl text-sm border-none shadow-sm font-bold" value={editData.tags || ''} onChange={e => setEditData({...editData, tags: e.target.value})} />
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveEdit} className="flex-1 bg-blue-900 text-white p-4 rounded-xl text-xs font-black shadow-lg">저장</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-200 p-4 rounded-xl text-xs font-black text-gray-500">취소</button>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-base font-black text-gray-700 tracking-tight">{p.product_name || '상세 정보 입력 대기 중...'}</p>
                  {p.tags && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {p.tags.split(',').map((tag, i) => (
                        <span key={i} className="text-[10px] font-bold text-blue-400 bg-blue-50/50 px-2 py-0.5 rounded-md italic">#{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 mb-4">
                {allImages.map((url, idx) => (
                  <img key={idx} src={url} className="w-32 h-32 md:w-44 md:h-44 object-cover rounded-[1.8rem] border-4 border-gray-50 flex-shrink-0 shadow-sm hover:scale-105 transition-all cursor-pointer" onClick={() => openModal(allImages, idx)} />
                ))}
              </div>
              
              {p.as_note && !isEditing && (
                <div className="mt-auto p-5 bg-red-50/50 rounded-[1.8rem] border border-red-50 text-xs text-red-900 font-semibold leading-relaxed">
                  <span className="font-black text-[9px] block mb-1 text-red-400 uppercase tracking-widest italic decoration-2 underline underline-offset-4">Installer Note</span>
                  {p.as_note}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 이미지 슬라이더 모달 */}
      {modalData.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-200" onClick={closeModal}>
          <button className="absolute top-6 right-6 text-white text-4xl" onClick={closeModal}>&times;</button>
          <button className="absolute left-4 md:left-10 text-white/50 hover:text-white text-5xl p-2" onClick={prevImg}>&#8249;</button>
          <div className="max-w-[90%] max-h-[85%] flex flex-col items-center">
            <img src={modalData.images[modalData.currentIndex]} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <p className="text-white/60 mt-4 font-black text-sm tracking-widest italic">{modalData.currentIndex + 1} / {modalData.images.length}</p>
          </div>
          <button className="absolute right-4 md:right-10 text-white/50 hover:text-white text-5xl p-2" onClick={nextImg}>&#8250;</button>
        </div>
      )}
    </main>
  )
}