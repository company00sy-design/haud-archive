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

  // 유저 확인 함수 (더 꼼꼼하게 수정)
  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      // 서버에서 직접 메타데이터 확인 (admin 여부)
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
      const afterUrls = await uploadImages(document.getElementById('after_imgs').files, 'after')
      const asUrls = await uploadImages(document.getElementById('as_imgs').files, 'as')
      
      const { error } = await supabase.from('projects').insert([{
        ...formData,
        installer_id: user.id,
        installer_name: user.email,
        after_urls: afterUrls,
        as_urls: asUrls
      }])
      if (error) throw error
      alert('등록 완료!')
      setFormData({...formData, product_name: '', color: '', as_note: ''})
      fetchProjects()
    } catch (err) { alert(err.message) }
    finally { setLoading(false) }
  }

  const filteredProjects = projects.filter(p => 
    p.product_name.includes(searchTerm) || p.manager.includes(searchTerm)
  )

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-10 flex flex-col justify-center min-h-screen bg-white">
        <h1 className="text-3xl font-black text-blue-900 mb-8 text-center uppercase tracking-tighter">hAUD SYSTEM</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="이메일" className="w-full p-4 border rounded-2xl bg-gray-50" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호" className="w-full p-4 border rounded-2xl bg-gray-50" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-900 text-white p-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100">로그인</button>
        </form>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-4 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900">
      <header className="flex justify-between items-end mb-8 py-4">
        <div>
          <h1 className="text-3xl font-black text-blue-900 leading-none">hAUD ARCHIVE</h1>
          <p className={`text-xs font-bold mt-2 px-2 py-1 rounded inline-block ${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
             {isAdmin ? '내근직원(관리자) 모드' : `${user.email} 기사님 모드`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-xs font-bold text-gray-400 underline decoration-2 underline-offset-4">LOGOUT</button>
      </header>

      {/* 요약 대시보드 */}
      <section className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">{isAdmin ? '전체 시공' : '나의 기록'}</p>
          <p className="text-3xl font-black text-blue-900">{projects.length}<span className="text-sm ml-1">건</span></p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">AS 발생</p>
          <p className="text-3xl font-black text-red-600">{projects.filter(p => p.as_note).length}<span className="text-sm ml-1 text-red-400">건</span></p>
        </div>
      </section>

      {/* 시공 등록 - 기사님용 */}
      <details className="bg-white p-6 rounded-3xl shadow-lg mb-10 border-2 border-blue-50">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center">
          <span className="text-lg">➕ 새 시공 기록 등록</span>
          <span className="text-xl">⌄</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 pt-4 border-t border-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 ml-1">시공일자</label>
              <input type="date" value={formData.work_date} className="p-3 border rounded-xl text-sm bg-gray-50 font-semibold" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 ml-1">설계 담당자</label>
              <input type="text" placeholder="이름" className="p-3 border rounded-xl text-sm bg-gray-50" onChange={e => setFormData({...formData, manager: e.target.value})} />
            </div>
          </div>
          <input type="text" value={formData.product_name} placeholder="제품명 (예: 냉장고장, 홈카페)" className="w-full p-4 border rounded-xl text-sm bg-gray-50" onChange={e => setFormData({...formData, product_name: e.target.value})} />
          <div className="p-4 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-100">
            <p className="text-xs font-bold text-blue-800 mb-2">📸 현장 사진 (After)</p>
            <input type="file" id="after_imgs" multiple accept="image/*" className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white" />
          </div>
          <textarea value={formData.as_note} placeholder="특이사항 또는 AS 내용 (없으면 비워두세요)" className="w-full p-4 border rounded-xl text-sm bg-gray-50 h-24" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-5 rounded-2xl font-bold text-lg">
            {loading ? '데이터 저장 중...' : '시공 데이터 기록 완료'}
          </button>
        </form>
      </details>

      {/* 리스트 및 검색 */}
      <div className="mb-6">
        <input type="text" placeholder="제품명이나 담당자 이름으로 검색..." className="w-full p-4 rounded-2xl border-none shadow-sm text-sm" onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="space-y-6">
        {filteredProjects.map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black text-blue-400 tracking-wider uppercase">{p.work_date}</span>
                <h3 className="font-black text-gray-900 text-xl mt-1 tracking-tighter">{p.product_name}</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">담당: {p.manager} {isAdmin && <span className="text-blue-600">| 기사: {p.installer_name?.split('@')[0]}</span>}</p>
              </div>
              {p.as_note && <span className="bg-red-100 text-red-600 text-[10px] px-3 py-1 rounded-full font-black">AS 관리</span>}
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              {p.after_urls?.map((url, idx) => (
                <img key={idx} src={url} className="w-28 h-28 object-cover rounded-2xl border-4 border-gray-50 flex-shrink-0 shadow-sm" onClick={() => window.open(url, '_blank')} />
              ))}
            </div>
            {p.as_note && (
              <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 text-sm text-red-900">
                <span className="font-black text-[10px] block mb-1 text-red-400">MEMO</span>
                {p.as_note}
              </div>
            )}
          </div>
        ))}
        {filteredProjects.length === 0 && <p className="text-center text-gray-300 py-20 font-bold">기록된 시공 내역이 없습니다.</p>}
      </div>
    </main>
  )
}