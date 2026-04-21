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

  // 수정 모드 상태
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const [modalData, setModalData] = useState({ isOpen: false, images: [], currentIndex: 0 })

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    customer_name: '', // 고객명 추가
    manager: '', 
    product_name: '', 
    tags: '', // 태그 직접 입력용
    as_note: ''
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
    let query = supabase.from('projects').select('*').order('work_date', { ascending: false })
    if (!isAdmin) query = query.eq('installer_id', user.id)
    const { data, error } = await query
    if (!error) setProjects(data)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('로그인 실패: ' + error.message)
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
      alert('등록 완료! 상세 정보는 내근직에서 업데이트 예정입니다.')
      setFormData({work_date: new Date().toISOString().split('T')[0], customer_name: '', manager: '', product_name: '', tags: '', as_note: ''})
      fetchProjects()
    } catch (err) { alert('등록 실패') }
    finally { setLoading(false) }
  }

  // 내근직 수정 기능
  const startEdit = (project) => {
    setEditingId(project.id)
    setEditData({ ...project })
  }

  const saveEdit = async () => {
    const { error } = await supabase.from('projects').update(editData).eq('id', editingId)
    if (!error) {
      alert('수정되었습니다.');
      setEditingId(null);
      fetchProjects();
    }
  }

  const openModal = (images, index) => setModalData({ isOpen: true, images, currentIndex: index })
  const closeModal = () => setModalData({ isOpen: false, images: [], currentIndex: 0 })
  const prevImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })) }
  const nextImg = (e) => { e.stopPropagation(); setModalData(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })) }

  const filteredProjects = projects.filter(p => 
    (p.product_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
    (p.customer_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (p.manager?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen bg-white">
        <h1 className="text-4xl font-black text-blue-900 mb-8 uppercase italic text-center">hAUD SYSTEM</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="이메일" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" className="w-full p-4 border rounded-2xl bg-gray-50 outline-none" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-900 text-white p-5 rounded-2xl font-black text-lg shadow-xl">로그인</button>
        </form>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900 transition-all">
      <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-100 px-2">
        <div>
          <h1 className="text-3xl font-black text-blue-900 leading-none uppercase italic">hAUD ARCHIVE</h1>
          <p className={`text-[11px] font-black mt-2 px-3 py-1 rounded-full inline-block ${isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '내근직원(관리자) 모드' : `${user.email.split('@')[0]} 기사님 모드`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest">Logout</button>
      </header>

      {/* 시공 등록 섹션 (기사님/내근직 공통이지만 기사님은 간소화된 항목만 입력) */}
      <details className="bg-white p-6 rounded-[2.5rem] shadow-xl mb-12 border-2 border-blue-50 overflow-hidden mx-2 transition-all">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <span className="text-lg font-black tracking-tight">새 시공 기록 등록</span>
          </div>
          <span className="bg-blue-50 px-4 py-2 rounded-full text-blue-900 text-[10px] font-black uppercase tracking-widest">Open</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">시공 일자</label>
              <input type="date" value={formData.work_date} className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">고객명 (현장명)</label>
              <input type="text" placeholder="예: 덕소아이파크 102동" value={formData.customer_name} className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-4 border-y py-6 border-gray-50">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 italic">Admin Only Section</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="영업 담당자" className="p-4 border-none rounded-2xl bg-blue-50/30 font-bold outline-none" onChange={e => setFormData({...formData, manager: e.target.value})} />
                <input type="text" placeholder="제품명" className="p-4 border-none rounded-2xl bg-blue-50/30 font-bold outline-none" onChange={e => setFormData({...formData, product_name: e.target.value})} />
              </div>
              <input type="text" placeholder="제품 태그 (쉼표로 구분: 무몰딩, 화이트, 푸시)" className="w-full p-4 border-none rounded-2xl bg-blue-50/30 font-bold outline-none" onChange={e => setFormData({...formData, tags: e.target.value})} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-dashed border-blue-100 text-center">
              <p className="text-[11px] font-black text-blue-800 mb-3 uppercase tracking-tighter">📸 완료 사진 (필수)</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
            <div className="p-6 bg-red-50/50 rounded-[2rem] border-2 border-dashed border-red-100 text-center">
              <p className="text-[11px] font-black text-red-800 mb-3 uppercase tracking-tighter">📸 AS 사진 (선택)</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px] w-full" />
            </div>
          </div>
          <textarea placeholder="기사님 전달사항 / AS 메모" className="w-full p-5 border-none rounded-[2rem] bg-gray-50 h-32 outline-none" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2rem] font-black text-xl shadow-2xl">
            {loading ? '데이터 저장 중...' : '시공 데이터 기록 완료'}
          </button>
        </form>
      </details>

      {/* 검색 바 */}
      <div className="mb-12 relative px-2">
        <input type="text" placeholder="고객명, 제품명, 담당자 이름으로 검색..." className="w-full p-6 pl-14 rounded-[2rem] border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-7 top-6 text-gray-300 text-xl">🔍</span>
      </div>

      {/* 리스트 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
        {filteredProjects.map((p) => {
          const isEditing = editingId === p.id;
          const allImages = [...(p.after_urls || []), ...(p.as_urls || [])];
          return (
            <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-white flex flex-col h-full group hover:shadow-xl transition-all relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-blue-300 tracking-widest uppercase">{p.work_date}</span>
                  {isEditing ? (
                    <input className="w-full text-2xl font-black mt-1 p-2 border-b outline-none" value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
                  ) : (
                    <h3 className="font-black text-gray-900 text-2xl mt-1 tracking-tighter group-hover:text-blue-900">{p.customer_name || '고객명 없음'}</h3>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-bold">
                     <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full uppercase">영업: {p.manager || '미지정'}</span>
                     <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase border border-blue-100">기사: {p.installer_name?.split('@')[0]}</span>
                  </div>
                </div>
                {isAdmin && !isEditing && (
                  <button onClick={() => startEdit(p)} className="text-[10px] font-black text-blue-500 hover:underline">수정</button>
                )}
              </div>

              {/* 내근직 수정 입력창 (수정 모드일 때만 보임) */}
              {isEditing ? (
                <div className="space-y-3 my-4 p-4 bg-blue-50/30 rounded-2xl">
                  <input placeholder="제품명" className="w-full p-2 bg-white rounded-lg text-sm" value={editData.product_name} onChange={e => setEditData({...editData, product_name: e.target.value})} />
                  <input placeholder="담당자" className="w-full p-2 bg-white rounded-lg text-sm" value={editData.manager} onChange={e => setEditData({...editData, manager: e.target.value})} />
                  <input placeholder="태그 (쉼표 구분)" className="w-full p-2 bg-white rounded-lg text-sm" value={editData.tags} onChange={e => setEditData({...editData, tags: e.target.value})} />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 bg-blue-900 text-white p-2 rounded-lg text-xs font-black">저장</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-200 p-2 rounded-lg text-xs font-black">취소</button>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-700">{p.product_name || '제품 정보 입력 대기'}</p>
                  {p.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.tags.split(',').map((tag, i) => (
                        <span key={i} className="text-[9px] text-gray-400">#{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 mb-4">
                {allImages.map((url, idx) => (
                  <img key={idx} src={url} className="w-24 h-24 object-cover rounded-2xl border-2 border-gray-50 flex-shrink-0 cursor-pointer hover:scale-105 transition-all" onClick={() => openModal(allImages, idx)} />
                ))}
              </div>
              
              {p.as_note && (
                <div className="mt-auto p-4 bg-red-50/50 rounded-2xl border border-red-50 text-[11px] text-red-900 font-medium">
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
          <button className="absolute left-4 text-white/50 text-5xl" onClick={prevImg}>&#8249;</button>
          <div className="max-w-[90%] max-h-[85%] flex flex-col items-center">
            <img src={modalData.images[modalData.currentIndex]} className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
            <p className="text-white/60 mt-4 font-black text-sm">{modalData.currentIndex + 1} / {modalData.images.length}</p>
          </div>
          <button className="absolute right-4 text-white/50 text-5xl" onClick={nextImg}>&#8250;</button>
        </div>
      )}
    </main>
  )
}