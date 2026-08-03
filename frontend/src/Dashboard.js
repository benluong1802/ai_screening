import React, { useState, useEffect } from 'react';
import './App.css';
import { API_URL } from "./config";

function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [currentTab, setCurrentTab] = useState('Pending');
  const [jobSearch, setJobSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEval, setSelectedEval] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewContent, setReviewContent] = useState(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [editableFeedback, setEditableFeedback] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("");
  const [selectedAssignJob, setSelectedAssignJob] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJobDesc, setEditJobDesc] = useState("");
  const [newQuestions, setNewQuestions] = useState([""]);
  const [editQuestions, setEditQuestions] = useState([]);
  useEffect(() => {
    const token =
      localStorage.getItem("token");

    if (!token) {

      window.location.href =
        "/login";

      return;

    }

    fetchInitialData();

  }, []);
  const openEmailReviewModal = (candidateEval, actionType) => {
    setActiveId(candidateEval.id);
    setPendingStatus(actionType);

    setSelectedEval(candidateEval);

    const candidateName = candidateEval.candidate?.full_name || "Candidate";

    if (actionType === "Approved") {

      setEmailSubject(
        "Interview Invitation"
      );

      const content = `
    <p>Dear ${candidateName},</p>

    <p>
      Thank you for your interest
      in our company.
    </p>

    <p>
      We are pleased to inform you
      that you have been selected
      for the next stage of our
      recruitment process.
    </p>

    <p>
      Our recruitment team will
      contact you soon.
    </p>

    <p>
      Best regards,<br>
      The Grand Ho Tram
    </p>
  `;

      setReviewContent(content);
      setEditableFeedback(content);
    } else {

      setEmailSubject(
        "Application Update"
      );

      const content = `
    <p>Dear ${candidateName},</p>

    <p>
      Thank you for applying.
    </p>

    <p>
      After careful consideration,
      we have decided to proceed
      with other candidates.
    </p>

    <p>
      We appreciate your interest
      and encourage you to apply
      again in the future.
    </p>

    <p>
      Best regards,<br>
      The Grand Ho Tram
    </p>
  `;

      setReviewContent(content);
      setEditableFeedback(content);
    }
  };
  const handleLogout = () => {

    localStorage.removeItem("token");

    window.location.href = "/login";

  };
  const openEditModal = () => {
    const job = jobs.find(j => j.id === selectedJobId);

    setEditJobTitle(job.title);
    setEditJobDesc(job.description_raw);
    setIsEditModalOpen(true);
    setEditQuestions(job.questions || []);
  };

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const handleUpdateJob = async () => {
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/jobs/${selectedJobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: editJobTitle,
        description_raw: editJobDesc,
        questions: editQuestions
      })
    });

    alert("Job updated!");
    setIsEditModalOpen(false);
    fetchInitialData();
  };

  const handleDeleteJob = async () => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/jobs/${selectedJobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    alert("Job deleted!");
    setIsEditModalOpen(false);
    setSelectedJobId(null);
    fetchInitialData();
  };

  const handleConfirmSendEmail = async () => {
    if (!activeId || !selectedEval) {
      alert("Không tìm thấy thông tin ứng viên hiện tại!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const finalEmailContent = editableFeedback && editableFeedback.trim() !== "" ? editableFeedback : reviewContent;
      const response = await fetch(`${API_URL}/evaluations/${activeId}/status?status=${pendingStatus}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          candidate_email: selectedEval.candidate?.email || "",
          candidate_name: selectedEval.candidate?.full_name || "",
          subject: emailSubject,
          email_content: finalEmailContent
        })
      });

      if (response.ok) {
        alert("Hệ thống đã cập nhật trạng thái và chuyển tiếp sang n8n gửi email thành công!");
        setReviewContent(null);
        setEditableFeedback("");
        setActiveId(null);
        fetchInitialData();
      } else {
        alert("Có lỗi xảy ra từ phía Backend Server.");
      }
    } catch (err) {
      console.error("Lỗi luồng gửi mail:", err);
      alert("Không thể kết nối tới Backend.");
    }
  };
  const handleAssignJob = async () => {

    if (!selectedAssignJob) {
      alert("Please select a job");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/evaluations/${selectedEval.id}/assign-job?job_id=${selectedAssignJob}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      alert("Resume assigned successfully");

      setIsDetailOpen(false);

      fetchInitialData();

    } catch {
      alert("Assign failed");
    }
  };
  const fetchInitialData = async () => {
    try {
      const token =
        localStorage.getItem("token");

      const headers = {
        Authorization: `Bearer ${token}`
      };

      const [jobsResponse, evalsResponse] =
        await Promise.all([
          fetch(`${API_URL}/jobs/`, { headers }),
          fetch(`${API_URL}/evaluations/`, { headers })
        ]);

      if (jobsResponse.ok && evalsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const evalsData = await evalsResponse.json();

        setJobs(jobsData);
        setEvaluations(evalsData);
        if (jobsData.length > 0) {
          setSelectedJobId(-1);
        }
      }
    } catch (error) {
      console.error("Lỗi khi kết nối lấy dữ liệu từ DB:", error);
    }
  };

  const filteredCandidates = evaluations.filter((item) => {

    const matchJob =
      selectedJobId === -1
        ? item.job_id === null   // ✅ unmatched
        : item.job_id === selectedJobId;

    const matchStatus = item.status?.toLowerCase() === currentTab.toLowerCase();

    const matchSearch = item.candidate?.full_name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchJob && matchStatus && matchSearch;
  });

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!newJobTitle || !newJobDesc) {
      alert("Vui lòng điền đầy đủ tiêu đề và nội dung JD!");
      return;
    }

    const payload = {
      title: newJobTitle,
      description_raw: newJobDesc,
      questions: newQuestions.filter(q => q.trim())
    };

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });


      if (response.ok) {
        const savedJob = await response.json();

        // ✅ gọi re-match
        await fetch(`${API_URL}/jobs/${savedJob.id}/rematch-unmatched`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setJobs([...jobs, savedJob]);
        setSelectedJobId(savedJob.id);


        setNewJobTitle('');
        setNewJobDesc('');
        setIsModalOpen(false);
        alert("Thêm vị trí tuyển dụng và tạo Vector Embedding thành công!");
      } else {
        alert("Job not found");
      }
    } catch (error) {
      console.error("Lỗi kết nối API:", error);
      alert("Không thể kết nối tới Backend server.");
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return "---";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="ats-container">
      <div className="ats-sidebar" style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh"
      }}>
        <div className="sidebar-header">Job Positions</div>
        <input
          type="text"
          placeholder="🔍 Search job..."
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          style={{
            margin: '10px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #333',
            backgroundColor: '#1a1c20',
            color: '#fff',
            outline: 'none'
          }}
        />
        <button className="add-job-btn" onClick={() => setIsModalOpen(true)}>
          + Add new job
        </button>

        <ul className="job-list" style={{
          flex: 1,
          overflowY: "auto"
        }}>
          <li
            className={`job-item ${selectedJobId === -1 ? 'active' : ''}`}
            onClick={() => setSelectedJobId(-1)}
          >
            🚫 Unmatched Resumes
          </li>

          {jobs.length > 0 ? (
            filteredJobs.map((job) => (
              <li
                key={job.id}
                className={`job-item ${selectedJobId === job.id ? 'active' : ''}`}
                onClick={() => setSelectedJobId(job.id)}
              >
                {job.title}
              </li>
            ))
          ) : (
            <li className="job-item" style={{ color: '#888', cursor: 'default' }}>Chưa có vị trí nào</li>
          )}
        </ul>
        <button
          onClick={handleLogout}
          style={{
            margin: "10px",
            padding: "12px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            marginTop: "auto"
          }}
        >
          Logout
        </button>
      </div>

      <div className="ats-main-content">


        <div className="main-header">
          {selectedJobId === -1
            ? "Unmatched Resumes"
            : selectedJobId === null
              ? "Please select a job"
              : jobs.find(j => j.id === selectedJobId)?.title}

          {selectedJobId && selectedJobId !== -1 && (
            <button onClick={() => openEditModal()}>
              Edit ⚙️
            </button>
          )}
        </div>



        <div className="status-tabs">

          {/* ✅ nhóm status */}
          <div className="tab-left">
            {['Pending', 'Approved', 'Rejected'].map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${currentTab.toLowerCase() === tab.toLowerCase() ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ✅ search nằm riêng */}
          <input
            type="text"
            placeholder="🔍 Search candidate ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="table-container">
          <table className="candidate-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Score AI</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td style={{ fontWeight: '500' }}>{candidate.candidate?.full_name || "Unknown"}</td>
                    <td>{candidate.candidate?.email || "---"}</td>
                    <td>{candidate.candidate?.phone || "No Phone Number"}</td>
                    <td style={{ fontWeight: 'bold', color: candidate.score >= 80 ? '#2ece56' : '#f05454' }}>
                      {candidate.score !== null ? `${candidate.score}/100` : "Unmatched"}
                    </td>
                    <td>
                      <span className={`badge ${candidate.status?.toLowerCase()}`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td style={{ color: '#666' }}>{formatDate(candidate.created_at)}</td>
                    <td className="actions-cell">
                      <button
                        className="action-btn view"
                        onClick={() => {
                          setSelectedEval(candidate);
                          setIsDetailOpen(true);
                        }}
                      >
                        👁
                      </button>

                      <button
                        className="action-btn approve"
                        onClick={() => openEmailReviewModal(candidate, 'Approved')}
                      >
                        ✓
                      </button>

                      <button
                        className="action-btn reject"
                        onClick={() => openEmailReviewModal(candidate, 'Rejected')}
                      >
                        ✕
                      </button>

                      <button className="action-btn refer">⟲</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                    Không có ứng viên nào ở trạng thái này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Tạo Vị Trí Tuyển Dụng Mới</h3>
            <p style={{ fontSize: '13px', color: '#aaa', margin: '0 0 10px 0' }}>
              Nội dung JD sau khi lưu sẽ tự động chuyển đổi sang Vector và lưu vào Vector Database.
            </p>

            <form onSubmit={handleSaveJob}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Tên vị trí công việc (Title)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Senior AI Engineer..."
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mô tả chi tiết công việc (Job Description)</label>
                <textarea
                  rows="8"
                  placeholder="Dán nội dung yêu cầu công việc, kỹ năng, tech stack vào đây..."
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">

                <label>Application Questions</label>

                {newQuestions.map((question, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "10px"
                    }}
                  >

                    <input
                      type="text"
                      value={question}
                      placeholder={`Question ${index + 1}`}
                      onChange={(e) => {
                        const updated = [...newQuestions];
                        updated[index] = e.target.value;
                        setNewQuestions(updated);
                      }}
                      style={{ flex: 1 }}
                    />

                    <button
                      type="button"
                      onClick={() => {

                        const updated =
                          newQuestions.filter((_, i) => i !== index);

                        setNewQuestions(updated);
                      }}
                    >
                      ❌
                    </button>

                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setNewQuestions([...newQuestions, ""]);
                  }}
                >
                  + Add Question
                </button>

              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-save">
                  Lưu & Tạo Vector
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDetailOpen && selectedEval && (
        <div className="modal-overlay">
          <div
            className="modal-content evaluation-detail"
            style={{
              width: '92%',
              maxWidth: selectedEval.resume_path ? '1300px' : '900px',
              display: 'flex',
              flexDirection: selectedEval.resume_path ? 'row' : 'column',
              gap: '20px',
              height: '85vh',
              backgroundColor: '#22252a',
              padding: '25px'
            }}
          >
            {selectedEval?.resume_path && (
              <div style={{ flex: 1.2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#0070ba', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.5px' }}>Hồ sơ ứng viên (PDF)</h4>

                {selectedEval?.resume_path ? (
                  <iframe
                    src={`${API_URL}${selectedEval.resume_path}`}
                    width="100%"
                    height="95%"
                    allow="autoplay"
                    title="Google Drive Preview"
                    style={{ border: 'none', borderRadius: '6px', backgroundColor: '#1a1c20' }}
                  ></iframe>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '95%', color: '#666', backgroundColor: '#1a1c20', borderRadius: '6px' }}>
                    Không tìm thấy mã File ID của ứng viên này.
                  </div>
                )}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingLeft: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Báo Cáo Thẩm Định Hồ Sơ Chi Tiết</h3>
                <button type="button" className="btn-cancel" style={{ padding: '5px 12px', cursor: 'pointer' }} onClick={() => setIsDetailOpen(false)}>✕ Đóng</button>
              </div>
              <hr style={{ borderColor: '#444', margin: '12px 0' }} />

              <div className="score-highlight">
                <div className={`score-circle ${selectedEval.score >= 75 ? 'high' : 'low'}`}>
                  {selectedEval.score ?? 'No Score'}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#fff' }}>{selectedEval.candidate?.full_name}</div>
                  <div style={{ fontSize: '13px', color: '#aaa' }}>{selectedEval.candidate?.email}</div>
                </div>
              </div>

              <div className="detail-section">
                <div
                  dangerouslySetInnerHTML={{ __html: selectedEval.summary || "Đang trích xuất dữ liệu..." }}
                  style={{
                    whiteSpace: 'pre-line',
                    lineHeight: '1.6',
                    backgroundColor: '#1e2124',
                    padding: '15px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    color: '#e0e0e0',
                    marginTop: '15px'
                  }}
                />
              </div>

              <div className="detail-section" style={{ flex: 1, marginTop: '15px' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: selectedEval.reason || "Đang đợi tổ đội CrewAI lập luận..." }}
                  style={{
                    whiteSpace: 'pre-line',
                    lineHeight: '1.6',
                    backgroundColor: '#1e2124',
                    padding: '15px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    color: '#e0e0e0'
                  }}
                />
                {selectedEval?.job_id === null && (
                  <div
                    style={{
                      marginBottom: "15px",
                      padding: "12px",
                      backgroundColor: "#1e2124",
                      borderRadius: "6px",
                      border: "1px solid #333",
                      marginTop: "15px"
                    }}
                  >
                    <h2 style={{ marginTop: "0px", marginBottom: "15px" }}>Assign Resume To Job</h2>

                    <select
                      value={selectedAssignJob}
                      onChange={(e) => setSelectedAssignJob(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        marginBottom: "10px",
                        backgroundColor: "#111",
                        color: "#fff",
                      }}
                    >
                      <option value="">-- Select Job --</option>

                      {jobs.map(job => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAssignJob}
                      style={{
                        backgroundColor: "#0078d4",
                        color: "white",
                        padding: "10px 16px",
                        border: "none",
                        borderRadius: "4px"
                      }}
                    >
                      Assign Job
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
      {reviewContent !== null && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '900px', maxWidth: '90vw', height: '85vh', maxHeight: '85vh', overflow: 'hidden', backgroundColor: '#22252a', position: 'relative', borderRadius: '8px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #333' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Review & Edit Email Draft (AI Generated)</h3>
              <button onClick={() => { setReviewContent(null); setEditableFeedback(""); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>×</button>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ color: '#aaa', fontSize: '13px' }}>Tiêu đề Email (Subject)</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '4px', backgroundColor: '#1a1c20', border: '1px solid #444', color: '#fff', outline: 'none' }}
              />
            </div>

            <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ color: '#aaa', fontSize: '13px' }}>Nội dung bức thư (HR có thể sửa trực tiếp vào khung dưới)</label>

              <div
                key={`${activeId}-${pendingStatus}`}
                contentEditable={true}
                suppressContentEditableWarning={true}

                onBlur={(e) => {
                  setEditableFeedback(e.currentTarget.innerHTML);
                }}

                dangerouslySetInnerHTML={{ __html: reviewContent }}
                style={{
                  backgroundColor: '#1a1c20',
                  padding: '20px',
                  borderRadius: '5px',
                  border: '1px solid #444',
                  lineHeight: '1.6',
                  outline: 'none',
                  color: '#fff',
                  flex: 1,
                  overflowY: 'auto',
                  minHeight: 0
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "15px",
                borderTop: "1px solid #333",
                paddingTop: "15px",
                flexWrap: "wrap"
              }}
            >
              <button
                onClick={() => { setReviewContent(null); setEditableFeedback(""); }}
                className="btn-cancel"
                style={{ padding: '12px 25px', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#333', color: '#fff', border: 'none' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendEmail}
                style={{
                  padding: '12px 30px',
                  backgroundColor: pendingStatus === 'Approved' ? '#2ece56' : '#f05454',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {pendingStatus === 'Approved' ? 'Approve & Send Invitation' : 'Reject & Send Notice'}
              </button>
            </div>

          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Chỉnh sửa Job</h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateJob();
            }}>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Tên vị trí công việc (Title)</label>
                <input
                  type="text"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mô tả công việc (JD)</label>
                <textarea
                  rows="8"
                  value={editJobDesc}
                  onChange={(e) => setEditJobDesc(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Hủy
                </button>

                <button
                  type="button"
                  style={{
                    color: "white"
                  }}
                  onClick={handleDeleteJob}
                >
                  Xóa Job
                </button>

                <button
                  type="submit"
                  className="btn-save"
                >
                  Lưu thay đổi
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;