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

  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    manager: '', product_name: '', color: '', tags: [], as_note: ''
  })

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      const role = user.user_metadata?.role || user.app_metadata?.role
      setIsAdmin(role === 'admin')
    }
  }

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) fetchProjects()
  }, [user, isAdmin])

  const fetchProjects = async () => {
    let query = supabase.from('projects').select('*').order('work_date', { ascending: false })
    if (!isAdmin) {
      query = query.eq('installer_id', user.id)
    }
    const { data, error } = await query
    if (!error) setProjects(data)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('로그인 실패: ' + error.message)
    else {
      const loggedInUser = data.user
      setUser(loggedInUser)
      const role = loggedInUser.user_metadata?.role || loggedInUser.app_metadata?.role
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
    setLoading(true)
    try {
      const afterInput = document.getElementById('after_imgs')
      const afterFiles = afterInput ? afterInput.files : []
      const afterUrls = await uploadImages(afterFiles, 'after')

      const asInput = document.getElementById('as_imgs')
      const asFiles = asInput ? asInput.files : []
      const asUrls = await uploadImages(asFiles, 'as')
      
      const { error } = await supabase.from('projects').insert([{
        ...formData,
        installer_id: user.id,
        installer_name: user.email,
        after_urls: afterUrls,
        as_urls: asUrls
      }])
      if (error) throw error
      alert('등록 완료!')
      setFormData({...formData, product_name: '', manager: '', as_note: ''})
      if (afterInput) afterInput.value = ""
      if (asInput) asInput.value = ""
      fetchProjects()
    } catch (err) { 
      console.error(err)
      alert('등록 실패: 관리자에게 문의하세요.') 
    }
    finally { setLoading(false) }
  }

  const filteredProjects = projects.filter(p => 
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.manager.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen bg-white font-sans text-center">
        <h1 className="text-4xl font-black text-blue-900 mb-8 uppercase italic tracking-tighter">hAUD SYSTEM</h1>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
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
          <h1 className="text-4xl font-black text-blue-900 leading-none tracking-tighter uppercase italic">hAUD ARCHIVE</h1>
          <p className={`text-[11px] font-black mt-2 px-3 py-1 rounded-full inline-block ${isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '내근직원(관리자) 모드' : `${user.email.split('@')[0]} 기사님 모드`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest pb-1 border-b border-gray-200">Logout</button>
      </header>

      {/* 1. 요약 대시보드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 px-2">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
          <p className="text-[10px] font-black text-gray-300 uppercase mb-1">{isAdmin ? '전체 시공' : '나의 기록'}</p>
          <p className="text-3xl font-black text-blue-900">{projects.length}<span className="text-sm ml-1 font-medium italic text-gray-400">건</span></p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
          <p className="text-[10px] font-black text-gray-300 uppercase mb-1">AS 발생</p>
          <p className="text-3xl font-black text-red-600">{projects.filter(p => p.as_note).length}<span className="text-sm ml-1 font-medium italic text-red-300">건</span></p>
        </div>
        {isAdmin && (
          <>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
              <p className="text-[10px] font-black text-gray-300 uppercase mb-1">활동 기사</p>
              <p className="text-3xl font-black text-green-600">{new Set(projects.map(p => p.installer_name)).size}<span className="text-sm ml-1">명</span></p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
              <p className="text-[10px] font-black text-gray-300 uppercase mb-1">최근 업데이트</p>
              <p className="text-xl font-black text-gray-800 mt-2">{projects[0]?.work_date.split('-').slice(1).join('/') || '-'}</p>
            </div>
          </>
        )}
      </section>

      {/* 2. 시공 등록 섹션 */}
      <details className="bg-white p-6 rounded-[2.5rem] shadow-xl mb-12 border-2 border-blue-50 overflow-hidden mx-2 transition-all">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2 focus:outline-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <span className="text-lg font-black tracking-tight">새 시공 기록 등록</span>
          </div>
          <span className="bg-blue-50 px-4 py-2 rounded-full text-blue-900 text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">Open</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">시공 일자</label>
              <input type="date" value={formData.work_date} className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-100" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">영업 담당자</label>
              <input type="text" placeholder="담당자 성함" className="p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-100" onChange={e => setFormData({...formData, manager: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">제품명</label>
            <input type="text" value={formData.product_name} placeholder="예: 무몰딩 붙박이장, 냉장고장 키친핏" className="w-full p-4 border-none rounded-2xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-100" onChange={e => setFormData({...formData, product_name: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-dashed border-blue-100 text-center">
              <p className="text-[11px] font-black text-blue-800 mb-3 uppercase tracking-tighter">📸 완료 사진 (필수)</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px] w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-900 file:text-white file:cursor-pointer" />
            </div>
            <div className="p-6 bg-red-50/50 rounded-[2rem] border-2 border-dashed border-red-100 text-center">
              <p className="text-[11px] font-black text-red-800 mb-3 uppercase tracking-tighter">📸 AS 사진 (선택)</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px] w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-red-900 file:text-white file:cursor-pointer" />
            </div>
          </div>
          <textarea value={formData.as_note} placeholder="AS 메모 또는 현장 특이사항을 입력하세요 (없으면 비워두세요)" className="w-full p-5 border-none rounded-[2rem] bg-gray-50 h-32 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-medium" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-100 active:scale-[0.98] transition-all">
            {loading ? '데이터 저장 중...' : '시공 데이터 기록 완료'}
          </button>
        </form>
      </details>

      {/* 3. 검색 바 */}
      <div className="mb-12 relative px-2">
        <input type="text" placeholder="제품명이나 담당자 성함으로 검색..." className="w-full p-6 pl-14 rounded-[2rem] border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white transition-all" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-7 top-6 text-gray-300 text-xl">🔍</span>
      </div>

      {/* 4. 시공 사례 리스트 (2열 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
        {filteredProjects.map((p) => (
          <div key={p.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-white hover:border-blue-100 hover:shadow-xl transition-all flex flex-col h-full group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <span className="text-[10px] font-black text-blue-300 tracking-[0.2em] uppercase">{p.work_date}</span>
                <h3 className="font-black text-gray-900 text-2xl mt-1 leading-tight tracking-tighter group-hover:text-blue-900 transition-colors uppercase">{p.product_name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                   <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">영업: {p.manager}</span>
                   {isAdmin && <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-blue-100">기사: {p.installer_name?.split('@')[0]}</span>}
                </div>
              </div>
              {p.as_note && <span className="bg-red-600 text-white text-[9px] px-3 py-1.5 rounded-full font-black uppercase animate-pulse shadow-lg shadow-red-100">AS</span>}
            </div>
            
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 mb-4">
              {p.after_urls?.map((url, idx) => (
                <img key={idx} src={url} className="w-32 h-32 md:w-44 md:h-44 object-cover rounded-[2rem] border-4 border-gray-50 flex-shrink-0 shadow-sm hover:scale-105 cursor-zoom-in transition-transform" onClick={() => window.open(url, '_blank')} />
              ))}
            </div>
            
            {p.as_note && (
              <div className="mt-auto p-5 bg-red-50/50 rounded-[2rem] border border-red-50 text-xs text-red-900 leading-relaxed font-semibold">
                <span className="font-black text-[9px] block mb-2 text-red-400 uppercase tracking-widest italic decoration-2 underline underline-offset-4">Memo / AS Note</span>
                {p.as_note}
              </div>
            )}
          </div>
        ))}
        {filteredProjects.length === 0 && <div className="col-span-full py-40 text-center font-black text-gray-200 text-5xl italic tracking-tighter opacity-30">NO DATA FOUND</div>}
      </div>
    </main>
  )
}