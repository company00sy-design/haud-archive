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
      // 1. 완료 사진 (after_imgs 존재 여부 체크)
      const afterInput = document.getElementById('after_imgs')
      const afterFiles = afterInput ? afterInput.files : []
      const afterUrls = await uploadImages(afterFiles, 'after')

      // 2. AS 사진 (as_imgs 존재 여부 체크)
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
      
      // 입력창 초기화
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
    p.product_name.includes(searchTerm) || p.manager.includes(searchTerm)
  )

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen bg-white font-sans text-center">
        <h1 className="text-4xl font-black text-blue-900 mb-8 uppercase italic tracking-tighter">hAUD SYSTEM</h1>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <input type="email" placeholder="이메일" className="w-full p-4 border rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" className="w-full p-4 border rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-900 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all">로그인</button>
        </form>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900 transition-all">
      <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-blue-900 leading-none tracking-tighter uppercase italic">hAUD ARCHIVE</h1>
          <p className={`text-[11px] font-black mt-2 px-3 py-1 rounded-full inline-block ${isAdmin ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '내근직원(관리자) 모드' : `${user.email.split('@')[0]} 기사님 모드`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest border-b border-gray-200 pb-1">Logout</button>
      </header>

      {/* 대시보드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
          <p className="text-[10px] font-black text-gray-300 uppercase mb-1">{isAdmin ? '전체 시공' : '나의 기록'}</p>
          <p className="text-3xl font-black text-blue-900">{projects.length}<span className="text-sm ml-1 font-medium">건</span></p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
          <p className="text-[10px] font-black text-gray-300 uppercase mb-1">AS 발생</p>
          <p className="text-3xl font-black text-red-600">{projects.filter(p => p.as_note).length}<span className="text-sm ml-1 font-medium">건</span></p>
        </div>
        {isAdmin && (
          <>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
              <p className="text-[10px] font-black text-gray-300 uppercase mb-1">참여 기사</p>
              <p className="text-3xl font-black text-green-600">{new Set(projects.map(p => p.installer_name)).size}<span className="text-sm ml-1">명</span></p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-white">
              <p className="text-[10px] font-black text-gray-300 uppercase mb-1">최근 업데이트</p>
              <p className="text-xl font-black text-gray-800 mt-2">{projects[0]?.work_date.split('-').slice(1).join('/') || '-'}</p>
            </div>
          </>
        )}
      </section>

      {/* 시공 등록 섹션 */}
      <details className="bg-white p-6 rounded-[2.5rem] shadow-xl mb-12 border-2 border-blue-50 overflow-hidden">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 px-2">
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
              <input type="date" value={formData.work_date} className="p-4 border-none rounded-2xl bg-gray-50 font-bold focus:ring-2 focus:ring-blue-100 outline-none" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">영업 담당자</label>
              <input type="text" placeholder="담당자 이름" className="p-4 border-none rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" onChange={e => setFormData({...formData, manager: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-gray-400 ml-2 uppercase">제품명</label>
            <input type="text" value={formData.product_name} placeholder="예: 무몰딩 붙박이장, 냉장고장" className="w-full p-4 border-none rounded-2xl bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none" onChange={e => setFormData({...formData, product_name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-dashed border-blue-100 text-center">
              <p className="text-[11px] font-black text-blue-800 mb-3 uppercase tracking-tighter">📸 완료 사진 (필수)</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px] w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-900 file:text-white" />
            </div>
            <div className="p-6 bg-red-50/50 rounded-[2rem] border-2 border-dashed border-red-100 text-center">
              <p className="text-[11px] font-black text-red-800 mb-3 uppercase tracking-tighter">📸 AS 사진 (선택)</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px] w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-red-900 file:text-white" />
            </div>
          </div>

          <textarea value={formData.as_note} placeholder="AS 메모 또는 현장 특이사항 (없으면 비워두세요)" className="w-full p-5 border-none rounded-[2rem] bg-gray-50 h-32 focus:ring-2 focus:ring-blue-100 outline-none text-sm" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-100 active:scale-[0.98] transition-all">
            {loading ? '데이터 업로드 중...' : '시공 데이터 기록 완료'}
          </button>
        </form>
      </details>

      {/* 검색 바 */}
      <div className="mb-12 relative">
        <input type="text" placeholder="제품명이나 담당자 이름으로 검색..." className="w-full p-5 pl-12 rounded-[2rem] border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-5 top-5 text-gray-300">🔍</span>
      </div>

      {/* 리스트 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredProjects.map((p) => (
          <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-white flex flex-col h-full group hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <span className="text-[10px] font-black text-blue-300 tracking-widest uppercase">{p.work_date}</span>
                <h3 className="font-black text-gray-900 text-2xl mt-1 leading-tight tracking-tighter group-hover:text-blue-900 transition-colors">{p.product_name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-bold">
                   <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full uppercase">영업: {p.manager}</span>
                   {isAdmin && <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">기사: {p.installer_name?.split('@')[0]}</span>}
                </div>
              </div>
              {p.as_note && <span className="bg-red-600 text-white text-[9px] px-3 py-1.5 rounded-full font-black uppercase shadow-lg shadow-red-100 animate-pulse">AS</span>}
            </div>
            
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 mb-4">
              {p.after_urls?.map((url, idx) => (
                <img key={idx} src={url} className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-[1.8rem] border-4 border-gray-50 flex-shrink-0 shadow-sm hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(url, '_blank')} />
              ))}
            </div>
            
            {p.as_note && (
              <div className="mt-auto p-5 bg-red-50/50 rounded-[1.8rem] border border-red-50 text-xs text-red-900 leading-relaxed font-medium">
                <span className="font-black text-[9px] block mb-2 text-red-400 uppercase tracking-widest italic underline decoration-2">Memo / AS Note</span>
                {p.as_note}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}