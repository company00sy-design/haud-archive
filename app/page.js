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
  const [selectedProject, setSelectedProject] = useState(null)
  const [editData, setEditData] = useState({})
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [modalData, setModalData] = useState({ isOpen: false, images: [], currentIndex: 0 })

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    customer_name: '', manager: '', product_name: '', tags: '', as_note: ''
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        setIsAdmin(user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin')
      }
    }
    checkUser()
  }, [])

  useEffect(() => { if (user) fetchProjects() }, [user, isAdmin])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from('projects').select('*').order('work_date', { ascending: false })
      if (!error) setProjects(data || [])
    } catch (err) { console.error("로드 실패") }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      setUser(data.user)
      setIsAdmin(data.user.user_metadata?.role === 'admin' || data.user.app_metadata?.role === 'admin')
    } else {
      alert('로그인 정보가 올바르지 않습니다.')
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
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(data.path)
          urls.push(publicUrl)
        }
      } catch (err) { console.error(err) }
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(!formData.customer_name) return alert('현장명을 입력해주세요.')
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
      if (!error) {
        alert('성공적으로 등록되었습니다.')
        window.location.reload()
      }
    } catch (err) { alert('등록 실패') }
    finally { setLoading(false) }
  }

  const openDetail = (p) => { setSelectedProject(p); setEditData({ ...p }); setIsDetailOpen(true); }

  const saveUpdate = async () => {
    setLoading(true)
    try {
      const extraFiles = document.getElementById('extra_imgs')?.files
      const extraUrls = await uploadImages(extraFiles, 'after')
      const updatedAfterUrls = [...(editData.after_urls || []), ...extraUrls]
      const { error } = await supabase.from('projects').update({
        ...editData,
        after_urls: updatedAfterUrls
      }).eq('id', selectedProject.id)
      if (!error) {
        alert('수정 완료')
        setIsDetailOpen(false)
        fetchProjects()
      }
    } catch (err) { alert('수정 실패') }
    finally { setLoading(false) }
  }

  const deleteProject = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return
    const { error } = await supabase.from('projects').delete().eq('id', selectedProject.id)
    if (!error) { alert('삭제 완료'); setIsDetailOpen(false); fetchProjects(); }
  }

  // [검색 로직] 태그, 현장명, 제품명, 담당자까지 모두 훑어내는 통합 검색
  const filteredProjects = projects.filter(p => {
    const s = searchTerm.toLowerCase()
    return (
      (p.customer_name || "").toLowerCase().includes(s) ||
      (p.product_name || "").toLowerCase().includes(s) ||
      (p.tags || "").toLowerCase().includes(s) ||
      (p.installer_name || "").toLowerCase().includes(s) ||
      (p.manager || "").toLowerCase().includes(s)
    )
  })

  const openPhotoModal = (images, index) => setModalData({ isOpen: true, images, currentIndex: index })
  const closePhotoModal = () => setModalData({ ...modalData, isOpen: false })
  const prevImg = (e) => { e.stopPropagation(); setModalData(p => ({ ...p, currentIndex: (p.currentIndex - 1 + p.images.length) % p.images.length })) }
  const nextImg = (e) => { e.stopPropagation(); setModalData(p => ({ ...p, currentIndex: (p.currentIndex + 1) % p.images.length })) }

  if (!user) return (
    <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen font-sans">
      <style jsx global>{` @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'); body { font-family: 'Pretendard', sans-serif; background-color: #f9fafb; } `}</style>
      <h1 className="text-4xl font-black text-blue-900 mb-8 text-center tracking-tighter">하우드 아카이브</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="email" placeholder="이메일" className="w-full p-4 border-none rounded-2xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="비밀번호" className="w-full p-4 border-none rounded-2xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-900 text-white p-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 hover:scale-[0.98] transition-all">로그인</button>
      </form>
    </main>
  )

  return (
    // [중요] max-w-6xl과 mx-auto를 사용하여 전체 너비를 일정하게 고정합니다.
    <div className="bg-gray-50 min-h-screen font-sans selection:bg-blue-100">
      <style jsx global>{` @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'); body { font-family: 'Pretendard', sans-serif; } `}</style>
      
      <main className="max-w-5xl mx-auto p-6 md:p-10 transition-all">
        <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-200 px-2">
          <div>
            <h1 className="text-3xl font-black text-blue-900 tracking-tighter">하우드 아카이브</h1>
            <p className={`text-xs px-3 py-1 rounded-full inline-block mt-2 font-bold ${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
               {isAdmin ? '관리자 모드' : `${user.email.split('@')[0]} 기사님`}
            </p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-xs font-bold text-gray-400 hover:text-red-500 pb-1 border-b">로그아웃</button>
        </header>

        {/* 신규 등록 섹션 */}
        <details className="bg-white p-6 rounded-[2.5rem] shadow-sm mb-12 border border-blue-50 overflow-hidden">
          <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none">
            <span className="text-lg font-black tracking-tight">➕ 신규 시공 사례 등록</span>
            <span className="text-xs text-blue-500 font-bold bg-blue-50 px-3 py-1 rounded-full">열기</span>
          </summary>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-400 ml-2">시공 날짜</label>
                <input type="date" value={formData.work_date} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none shadow-inner" onChange={e => setFormData({...formData, work_date: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-400 ml-2">현장명 (고객명)</label>
                <input type="text" placeholder="예: 김세연 고객님 / 덕소아이파크" value={formData.customer_name} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none shadow-inner" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
              <div className="p-6 bg-blue-50/30 rounded-[2rem] border-2 border-dashed border-blue-100">
                <p className="text-xs font-black text-blue-800 mb-2">📸 시공 완료 사진</p>
                <input type="file" id="after_imgs" multiple accept="image/*" className="text-xs w-full" />
              </div>
              <div className="p-6 bg-red-50/30 rounded-[2rem] border-2 border-dashed border-red-100">
                <p className="text-xs font-black text-red-800 mb-2">📸 AS 사진 (있을 경우만)</p>
                <input type="file" id="as_imgs" multiple accept="image/*" className="text-xs w-full" />
              </div>
            </div>
            <textarea placeholder="메모 및 특이사항을 입력해 주세요" className="w-full p-5 rounded-[2rem] bg-gray-50 h-32 outline-none border-none shadow-inner text-sm font-medium" onChange={e => setFormData({...formData, as_note: e.target.value})} />
            <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all">
              {loading ? '데이터 전송 중...' : '시공 데이터 기록 완료'}
            </button>
          </form>
        </details>

        {/* 검색 바 */}
        <div className="mb-10 relative px-2">
          <input type="text" placeholder="현장명, 제품명, 태그(#), 담당자로 검색..." className="w-full p-6 pl-14 rounded-[2.5rem] border-none shadow-md text-sm outline-none bg-white focus:ring-2 focus:ring-blue-100 transition-all font-bold" onChange={e => setSearchTerm(e.target.value)} />
          <span className="absolute left-8 top-7 text-gray-300 text-xl font-light">🔍</span>
        </div>

        {/* 시공 사례 리스트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
          {filteredProjects.map((p) => (
            <div key={p.id} onClick={() => openDetail(p)} className="bg-white rounded-[3rem] overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-white group flex flex-col">
              <div className="h-64 overflow-hidden relative bg-gray-100">
                {p.after_urls?.[0] ? <img src={p.after_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-black">사진 없음</div>}
                <div className="absolute top-5 left-5 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-blue-900 shadow-sm">{p.work_date}</div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-black text-gray-800 mb-1 tracking-tighter leading-tight group-hover:text-blue-900 transition-colors">{p.customer_name}</h3>
                <p className="text-xs font-bold text-blue-500 mb-4 uppercase">시공: {p.installer_name?.split('@')[0]}</p>
                <div className="mt-auto pt-5 border-t border-gray-50 flex justify-between items-center font-bold">
                  <p className="text-gray-400 text-[11px] truncate flex-1 mr-4">{p.product_name || '기본 정보'}</p>
                  <span className="text-blue-600 text-xs whitespace-nowrap">상세보기 →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 상세 보기 모달 */}
      {isDetailOpen && selectedProject && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-8 md:p-12 border-b flex justify-between items-start sticky top-0 bg-white z-10 font-bold">
              <div>
                <span className="text-xs text-blue-400 font-black tracking-widest">시공 상세 기록</span>
                <input className="block text-4xl font-black mt-2 bg-transparent border-b-2 border-blue-50 outline-none w-full tracking-tighter" value={editData.customer_name || ''} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center text-2xl text-gray-400 hover:text-black transition-all shadow-sm">&times;</button>
            </div>
            <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12 text-sm font-bold">
              <div className="space-y-6">
                <p className="text-xs text-gray-300 font-black tracking-widest uppercase">Photos</p>
                <div className="grid grid-cols-2 gap-3">
                  {[...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])].map((url, i) => (
                    <img key={url} src={url} onClick={() => openPhotoModal([...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])], i)} className="w-full h-40 object-cover rounded-[1.5rem] border-4 border-gray-50 shadow-sm cursor-zoom-in hover:scale-105 transition-all" />
                  ))}
                </div>
                <div className="p-6 bg-blue-50/50 rounded-[1.5rem] border-2 border-dashed border-blue-100 text-center text-xs font-black text-blue-800">
                  <p className="mb-2 uppercase">➕ 사진 추가하기</p>
                  <input type="file" id="extra_imgs" multiple accept="image/*" className="w-full" />
                </div>
              </div>
              <div className="flex flex-col space-y-6">
                <div className="flex flex-col gap-1.5"><label className="text-xs font-black text-blue-400 uppercase tracking-widest">Product</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-none shadow-inner" value={editData.product_name || ''} placeholder="시공 제품명" onChange={e => setEditData({...editData, product_name: e.target.value})} /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-black text-blue-400 uppercase tracking-widest">Manager</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-none shadow-inner" value={editData.manager || ''} placeholder="담당자 성함" onChange={e => setEditData({...editData, manager: e.target.value})} /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-black text-blue-400 uppercase tracking-widest">Tags</label><input className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-none shadow-inner" value={editData.tags || ''} placeholder="예: 무몰딩, 화이트, 푸시" onChange={e => setEditData({...editData, tags: e.target.value})} /></div>
                <div className="flex gap-3 mt-auto pt-10 font-black transition-all">
                  <button onClick={saveUpdate} disabled={loading} className="flex-[3] bg-blue-900 text-white p-6 rounded-[1.8rem] shadow-xl shadow-blue-100 active:scale-95 transition-all">수정 내용 저장</button>
                  <button onClick={deleteProject} className="flex-1 bg-red-50 text-red-600 p-6 rounded-[1.8rem] hover:bg-red-600 hover:text-white transition-all shadow-sm text-xs font-bold">삭제</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 슬라이더 */}
      {modalData.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center animate-in fade-in duration-300" onClick={closePhotoModal}>
          <button className="absolute top-8 right-8 text-white text-5xl font-light hover:rotate-90 transition-all" onClick={closePhotoModal}>&times;</button>
          <button className="absolute left-6 md:left-12 text-white/40 hover:text-white text-7xl p-2 transition-all" onClick={prevImg}>&#8249;</button>
          <div className="max-w-[85%] max-h-[80%] flex flex-col items-center">
            <img src={modalData.images[modalData.currentIndex]} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10 shadow-blue-500/10" onClick={(e) => e.stopPropagation()} />
            <p className="text-white font-black text-sm mt-8 tracking-widest">{modalData.currentIndex + 1} / {modalData.images.length}</p>
          </div>
          <button className="absolute right-6 md:right-12 text-white/40 hover:text-white text-7xl p-2 transition-all" onClick={nextImg}>&#8250;</button>
        </div>
      )}
    </div>
  )
}