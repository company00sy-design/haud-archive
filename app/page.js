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
  
  // 상세 보기 및 수정을 위한 상태
  const [selectedProject, setSelectedProject] = useState(null); // 클릭한 프로젝트 저장
  const [editData, setEditData] = useState({});
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
      alert('시공 기록이 등록되었습니다.');
      setFormData({work_date: new Date().toISOString().split('T')[0], customer_name: '', manager: '', product_name: '', tags: '', as_note: ''})
      fetchProjects()
    } catch (err) { alert('등록 실패') }
    finally { setLoading(false) }
  }

  // 상세 창 열기
  const openDetail = (project) => {
    setSelectedProject(project);
    setEditData({ ...project });
    setIsDetailOpen(true);
  }

  // 업데이트 저장
  const saveUpdate = async () => {
    const { error } = await supabase.from('projects').update(editData).eq('id', selectedProject.id)
    if (!error) {
      alert('정보가 업데이트되었습니다.');
      setIsDetailOpen(false);
      fetchProjects();
    }
  }

  // 삭제 기능
  const deleteProject = async () => {
    if (!confirm("이 시공 사례를 정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from('projects').delete().eq('id', selectedProject.id)
    if (!error) {
      alert('삭제되었습니다.');
      setIsDetailOpen(false);
      fetchProjects();
    }
  }

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
    <main className="max-w-6xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen pb-20 font-sans text-gray-900">
      <header className="flex justify-between items-end mb-10 py-4 border-b-2 border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-blue-900 uppercase italic tracking-tighter">hAUD ARCHIVE</h1>
          <p className="text-[11px] font-black mt-1 text-gray-400">
             {isAdmin ? '관리자(내근직) 모드' : `${user.email.split('@')[0]} 기사님`}
          </p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => setUser(null))} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest border-b pb-1">Logout</button>
      </header>

      {/* [등록 버튼] - 평소엔 숨겨져 있음 */}
      <details className="bg-white p-6 rounded-[2.5rem] shadow-sm mb-12 border border-blue-50">
        <summary className="font-bold text-blue-900 cursor-pointer list-none flex justify-between items-center py-2 focus:outline-none">
          <div className="flex items-center gap-3">
            <span className="text-xl">➕</span>
            <span className="text-lg font-black tracking-tight">신규 시공 등록</span>
          </div>
          <span className="text-[10px] font-black text-gray-300 uppercase">Click to open</span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 pt-8 border-t border-gray-100 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-gray-400 ml-2 uppercase">시공일</label>
              <input type="date" value={formData.work_date} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none" onChange={e => setFormData({...formData, work_date: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-gray-400 ml-2 uppercase">고객명/현장명</label>
              <input type="text" placeholder="예: 덕소아이파크 101동" value={formData.customer_name} className="p-4 rounded-2xl bg-gray-50 font-bold outline-none border-none" onChange={e => setFormData({...formData, customer_name: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="p-6 bg-blue-50/30 rounded-[2rem] border-2 border-dashed border-blue-100">
              <p className="text-[10px] font-black text-blue-800 mb-2 uppercase tracking-widest">완료 사진</p>
              <input type="file" id="after_imgs" multiple accept="image/*" className="text-[10px]" />
            </div>
            <div className="p-6 bg-red-50/30 rounded-[2rem] border-2 border-dashed border-red-100">
              <p className="text-[10px] font-black text-red-800 mb-2 uppercase tracking-widest">AS 사진</p>
              <input type="file" id="as_imgs" multiple accept="image/*" className="text-[10px]" />
            </div>
          </div>
          <textarea placeholder="전달사항 / AS 메모" className="w-full p-5 rounded-[2rem] bg-gray-50 h-28 outline-none text-sm border-none shadow-inner" onChange={e => setFormData({...formData, as_note: e.target.value})} />
          <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-5 rounded-[2rem] font-black text-lg shadow-xl hover:bg-blue-800 transition-all">
            {loading ? '데이터 전송 중...' : '기록 저장하기'}
          </button>
        </form>
      </details>

      {/* 검색 바 */}
      <div className="mb-10 relative">
        <input type="text" placeholder="현장명, 제품명, 담당자 검색..." className="w-full p-5 pl-14 rounded-[2rem] border-none shadow-sm text-sm outline-none bg-white focus:ring-2 focus:ring-blue-100 transition-all" onChange={e => setSearchTerm(e.target.value)} />
        <span className="absolute left-6 top-5 text-gray-300">🔍</span>
      </div>

      {/* 리스트 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((p) => (
          <div key={p.id} onClick={() => openDetail(p)} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-white group">
            <div className="h-56 overflow-hidden relative bg-gray-100">
              {p.after_urls?.[0] ? (
                <img src={p.after_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs italic uppercase">No Image</div>
              )}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[9px] font-black text-blue-900 shadow-sm">{p.work_date}</div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tighter uppercase">{p.customer_name}</h3>
              <p className="text-xs font-bold text-gray-400 truncate mb-4">{p.product_name || '상세 정보 입력 대기'}</p>
              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">By {p.installer_name?.split('@')[0]}</span>
                <span className="text-[10px] font-bold text-blue-500">자세히 보기 →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* [상세 모달] - 사례를 눌렀을 때만 튀어나옵니다 */}
      {isDetailOpen && selectedProject && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="p-8 md:p-10 border-b flex justify-between items-start bg-gray-50/50">
              <div>
                <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase">{selectedProject.work_date} 시공</span>
                {isAdmin ? (
                  <input className="block text-3xl font-black mt-1 bg-transparent border-b border-blue-200 outline-none w-full" value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
                ) : (
                  <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mt-1">{selectedProject.customer_name}</h2>
                )}
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-black">&times;</button>
            </div>

            <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* 왼쪽: 이미지 영역 */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Photos</p>
                <div className="grid grid-cols-2 gap-2">
                  {[...(selectedProject.after_urls || []), ...(selectedProject.as_urls || [])].map((url, i) => (
                    <img key={i} src={url} className="w-full h-32 object-cover rounded-2xl border" />
                  ))}
                </div>
                {selectedProject.as_note && (
                  <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-[9px] font-black text-red-400 uppercase mb-2">Installer Note</p>
                    <p className="text-xs text-red-900 font-medium leading-relaxed">{selectedProject.as_note}</p>
                  </div>
                )}
              </div>

              {/* 오른쪽: 내근직 전용 입력/보기 영역 */}
              <div className="flex flex-col h-full">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Case Details</p>
                
                <div className="space-y-5 flex-1">
                  {isAdmin ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-blue-400 ml-1">제품명</label>
                        <input className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold border-none" value={editData.product_name || ''} placeholder="예: 무몰딩 붙박이장" onChange={e => setEditData({...editData, product_name: e.target.value})} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-blue-400 ml-1">영업 담당자</label>
                        <input className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold border-none" value={editData.manager || ''} placeholder="담당자 이름" onChange={e => setEditData({...editData, manager: e.target.value})} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-blue-400 ml-1">태그 (쉼표 구분)</label>
                        <input className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold border-none" value={editData.tags || ''} placeholder="화이트, 무몰딩, 푸시" onChange={e => setEditData({...editData, tags: e.target.value})} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase mb-1 italic">Product</p>
                        <p className="text-lg font-black text-gray-800">{selectedProject.product_name || '정보 대기 중'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase mb-1 italic">Sales Manager</p>
                        <p className="text-lg font-black text-gray-800">{selectedProject.manager || '미지정'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedProject.tags?.split(',').map((tag, i) => (
                          <span key={i} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-lg">#{tag.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 모달 하단 버튼 (관리자용) */}
                {isAdmin && (
                  <div className="flex gap-2 mt-10">
                    <button onClick={saveUpdate} className="flex-[2] bg-blue-900 text-white p-5 rounded-2xl font-black text-sm shadow-xl">정보 업데이트</button>
                    <button onClick={deleteProject} className="flex-1 bg-red-50 text-red-600 p-5 rounded-2xl font-black text-sm hover:bg-red-600 hover:text-white transition-all">삭제</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}