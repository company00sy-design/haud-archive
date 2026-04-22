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
        alert('기록이 완료되었습니다.')
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
        alert('수정되었습니다.')
        setIsDetailOpen(false)
        fetchProjects()
      }
    } catch (err) { alert('수정 실패') }
    finally { setLoading(false) }
  }

  const deleteProject = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return
    const { error } = await supabase.from('projects').delete().eq('id', selectedProject.id)
    if (!error) { alert('삭제되었습니다.'); setIsDetailOpen(false); fetchProjects(); }
  }

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
        <input type="email" placeholder="이메일 주소" className="w-full p-4 border-none rounded-2xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="비밀번호" className="w-full p-4 border-none rounded-2xl bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-900 text-white p-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 hover:scale-[0.98] transition-all">로그인</button>
      </form>
    </main>
  )

  return (
    <div className="bg-gray-50 min-h-screen font-sans selection:bg-blue-100">
      <style jsx global>{` @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'); body { font-family: 'Pretendard', sans-serif; } `}</style>
      
      {/* PC 환경에서 더 넓게 보이도록 max-w-7xl로 확장 */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 transition-all">
        <header className="flex justify-between items-end mb-12 py-6 border-b-2 border-gray-200 px-2 font-black tracking-tighter">
          <div>
            <h1 className="text-4xl text-blue-900 uppercase">하우드 아카이브</h1>
            <p className={`text-xs px-4 py-1.5 rounded-full inline-block mt-3 ${isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-200 text-gray-600'}`}>
               {isAdmin ? '관리자 모드' : `${user.email.split('@')[0]} 기사님`}
            </p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-sm font-bold text-gray-400 hover:text-red-500 pb-1 border-b-2 border-transparent hover:border-red-200 transition-all">로그아웃</button>
        </header>

        <details className="bg-white p-8 rounded-[3rem] shadow-sm mb-16 border border-blue-50 overflow-hidden transition-all">
          <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none uppercase font-black">
            <span className="text-xl">➕ 신규 시공 사례 등록</span>
            <span className="text-xs text-blue-500 font-black bg-blue-50 px-4 py-2 rounded-full tracking-widest">열기</span>
          </summary>
          <form onSubmit={handleSubmit} className="mt-10 space-y-8 pt-10 border-t border-gray-100 text-left px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-black">
              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-400 ml-2">시공 날짜</label>
                <input type="date" value={formData.work_date} className="p-5 rounded-[1.5rem] bg-gray-50 outline-none border-none shadow-inner text-lg" onChange={e => setFormData({...formData, work_date: e.target.value})} />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-400 ml-2">현장명 (고객명)</label>
                <input type="text" placeholder="현장명을 입력해 주세요" value={formData.customer_name} className="p-5 rounded-[1.5rem] bg-gray-50 outline-none border-none shadow-inner text-lg" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center font-black">
              <div className="p-10 bg-blue-50/50 rounded-[2.5rem] border-2 border-dashed border-blue-100 transition-all hover:bg-blue-50">
                <p className="text-sm text-blue-800 mb-3 uppercase">📸 시공 완료 사진</p>
                <input type="file" id="after_imgs" multiple accept="image/*" className="text-sm w-full" />
              </div>
              <div className="p-10 bg-red-50/50 rounded-[2.5rem] border-2 border-dashed border-red-100 transition-all hover:bg-red-50">
                <p className="text-sm text-red-800 mb-3 uppercase">📸 AS 사진</p>
                <input type="file" id="as_imgs" multiple accept="image/*" className="text-sm w-full" />
              </div>
            </div>
            <textarea placeholder="기사님 전달사항 또는 특이사항을 상세히 입력해 주세요" className="w-full p-6 rounded-[2.5rem] bg-gray-50 h-48 outline-none border-none shadow-inner text-lg font-black" onChange={e => setFormData({...formData, as_note: e.target.value})} />
            <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-7 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-95 transition-all">
              {loading ? '전송 중...' : '시공 데이터 기록 완료'}
            </button>
          </form>
        </details>

        <div className="mb-16 relative px-2">
          <input type="text" placeholder="현장명, 제품명, 태그, 기사님 성함으로 검색..." className="w-full p-7 pl-16 rounded-[2.5rem] border-none shadow-lg text-lg outline-none bg-white focus:ring-4 focus:ring-blue-100 transition-all font-black" onChange={e => setSearchTerm(e.target.value)} />
          <span className="absolute left-9 top-8 text-gray-300 text-2xl">🔍</span>
        </div>

        {/* 그리드 간격 확장 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-2">
          {filteredProjects.map((p) => (
            <div key={p.id} onClick={() => openDetail(p)} className="bg-white rounded-[3.5rem] overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer border border-white group flex flex-col font-black">
              <div className="h-80 overflow-hidden relative bg-gray-100">
                {p.after_urls?.[0] ? <img src={p.after_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm uppercase font-black">사진 없음</div>}
                <div className="absolute top-7 left-7 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full text-xs text-blue-900 shadow-sm">{p.work_date}</div>
              </div>
              <div className="p-10 flex-1 flex flex-col">
                <h3 className="text-3xl text-gray-800 mb-2 tracking-tighter leading-tight uppercase group-hover:text-blue-900 transition-colors">{p.customer_name}</h3>
                <p className="text-sm text-blue-500 mb-6 uppercase tracking-tighter">시공 담당: {p.installer_name?.split('@')[0]}</p>
                <div className="mt-auto pt-7 border-t border-gray-100 flex justify-between items-center">
                  <p className="text-gray-400 text-sm truncate flex-1 mr-4">{p.product_name || '상세 내역 없음'}</p>
                  <span className="text-blue-600 text-sm whitespace-nowrap font-black">자세히 보기 →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 상세 보기 모달 - PC에서 더 크게 보이도록 max-w-6xl로 확장 */}
      {isDetailOpen && selectedProject && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl overflow-hidden relative max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-10 md:p-14 border-b flex justify-between items-start sticky top-0 bg-white z-10 font-black">
              <div className="flex flex-col gap-2 w-full">
                <span className="text-sm text-blue-400 tracking-widest font-black">하우드 시공 상세 기록</span>
                <div className="flex items-center gap-4 mt-2 w-full group">
                   <span className="text-4xl text-gray-300 whitespace-nowrap">고객명 :</span>
                   <input className="block text-4xl font-black bg-transparent border-b-4 border-blue-50 outline-none flex-1 tracking-tighter transition-colors focus:border-blue-500 py-1" value={editData.customer_name || ''} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center text-4xl text-gray-400 hover:text-black transition-all shadow-sm font-light hover:bg-gray-200">&times;</button>
            </div>
            <div className="p-10 md:p-14 grid grid-cols-1 lg:grid-cols-2 gap-16 text-sm font-black">
              <div className="space-y-8">
                <p className="text-sm text-gray-300 tracking-[0.2em] uppercase font-black">시공 현장 갤러리</p>
                <div className="grid grid-cols-2 gap-5">
                  {[...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])].map((url, i) => (
                    <img key={url} src={url} onClick={() => openPhotoModal([...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])], i)} className="w-full h-56 object-cover rounded-[2rem] border-4 border-gray-50 shadow-md cursor-zoom-in hover:scale-105 transition-all" />
                  ))}
                </div>
                <div className="p-10 bg-blue-50/50 rounded-[2.5rem] border-2 border-dashed border-blue-100 text-center text-sm font-black text-blue-800 transition-all hover:bg-blue-100">
                  <p className="mb-3 uppercase tracking-widest">➕ 추가 사진 업로드</p>
                  <input type="file" id="extra_imgs" multiple accept="image/*" className="w-full" />
                </div>
              </div>
              <div className="flex flex-col space-y-8 font-black uppercase">
                <div className="flex flex-col gap-3"><label className="text-xs text-blue-400 tracking-widest">시공 제품 정보</label><input className="w-full p-6 bg-gray-50 rounded-3xl font-black outline-none border-none shadow-inner text-xl" value={editData.product_name || ''} onChange={e => setEditData({...editData, product_name: e.target.value})} /></div>
                <div className="flex flex-col gap-3"><label className="text-xs text-blue-400 tracking-widest">현장 영업 담당</label><input className="w-full p-6 bg-gray-50 rounded-3xl font-black outline-none border-none shadow-inner text-xl" value={editData.manager || ''} onChange={e => setEditData({...editData, manager: e.target.value})} /></div>
                <div className="flex flex-col gap-3"><label className="text-xs text-blue-400 tracking-widest">검색 키워드 태그</label><input className="w-full p-6 bg-gray-50 rounded-3xl font-black outline-none border-none shadow-inner text-xl" value={editData.tags || ''} placeholder="쉼표로 구분 (예: 무몰딩, 푸시)" onChange={e => setEditData({...editData, tags: e.target.value})} /></div>
                <div className="flex gap-5 mt-auto pt-16 font-black">
                  <button onClick={saveUpdate} disabled={loading} className="flex-[3] bg-blue-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 active:scale-95 transition-all text-xl">기록 수정 완료</button>
                  <button onClick={deleteProject} className="flex-1 bg-red-50 text-red-600 p-8 rounded-[2.5rem] hover:bg-red-600 hover:text-white transition-all shadow-sm text-sm uppercase">기록 삭제</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 슬라이더 - PC에서 훨씬 크게 보이도록 조정 */}
      {modalData.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/98 flex items-center justify-center animate-in fade-in duration-300" onClick={closePhotoModal}>
          <button className="absolute top-10 right-10 text-white text-6xl font-light hover:rotate-90 transition-all font-light" onClick={closePhotoModal}>&times;</button>
          <button className="absolute left-8 md:left-16 text-white/40 hover:text-white text-9xl p-4 transition-all font-light" onClick={prevImg}>&#8249;</button>
          <div className="max-w-[92%] max-h-[88%] flex flex-col items-center font-black">
            <img src={modalData.images[modalData.currentIndex]} className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl border border-white/5" onClick={(e) => e.stopPropagation()} />
            <p className="text-white font-black text-lg mt-10 tracking-[0.5em] bg-white/10 px-8 py-3 rounded-full">{modalData.currentIndex + 1} / {modalData.images.length}</p>
          </div>
          <button className="absolute right-8 md:right-16 text-white/40 hover:text-white text-9xl p-4 transition-all font-light" onClick={nextImg}>&#8250;</button>
        </div>
      )}
    </div>
  )
}