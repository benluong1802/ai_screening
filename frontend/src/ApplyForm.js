import React, { useEffect, useState } from "react";
import './ApplyForm.css';
import { API_URL } from "./config";
function ApplyForm() {
  const [jobs, setJobs] = useState([]);
  // const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    age: "",
    phone: "",
    email: "",
    job_id: ""
  });

  const [hasCV, setHasCV] = useState(null);
  const handleReset = () => {
    setForm({
      name: "",
      age: "",
      phone: "",
      email: "",
      job_id: ""
    });

    setHasCV(null);
    setSelectedFile(null);
  };

  // ✅ fetch jobs
  useEffect(() => {
    fetch(`${API_URL}/public/jobs`)
      .then(res => res.json())
      .then(data => setJobs(data));
  }, []);

  // ✅ filter jobs (search)
  const filteredJobs = jobs;
  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.job_id) {
      alert("Vui lòng nhập tên, số điện thoại và chọn công việc");
      return;
    }

    if (hasCV === true && !selectedFile) {
      alert("Vui lòng upload CV");
      return;
    }

    if (hasCV === true) {
      if (selectedFile) {
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB

        if (selectedFile.size > MAX_SIZE) {
          alert("PDF must be smaller than 5MB");
          return;
        }
      }
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("age", form.age);
      formData.append("phone", form.phone);
      formData.append("email", form.email);
      formData.append("job_id", form.job_id);
      formData.append("resume_file", selectedFile);

      try {
        const response = await fetch(`${API_URL}/apply-with-cv`, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error("Submit failed");
        }

        alert("Ứng tuyển thành công! Hệ thống đang chấm điểm hồ sơ.");

        handleReset();

      } catch (error) {
        console.error(error);
        alert("Không thể gửi hồ sơ");
      }
    }
    if (hasCV === false) {
      const jobQuestions = selectedJob?.questions || [];

      if (answers.length !== jobQuestions.length) {
        alert("Please answer all questions.");
        return;
      }

      const emptyAnswers =
        answers.some(
          answer => !answer?.trim()
        );

      if (emptyAnswers) {
        alert("Please answer all questions.");
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/apply-without-cv`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: form.name,
              phone: form.phone,
              email: form.email,
              job_id: Number(form.job_id),
              answers: answers
            })
          }
        );

        if (!response.ok) {
          throw new Error();
        }

        alert("Đơn ứng tuyển đã gửi");
        handleReset();

      } catch (error) {
        console.error(error);
        alert(error);
      }

      return;
    }
  };
  const selectedJob = jobs.find(
    (job) => job.id === Number(form.job_id)
  );
  return (
    <div className="apply-container">
      <div className="apply-card">

        <div className="apply-title">Ứng tuyển công việc</div>
        <div className="apply-subtitle">
          Điền thông tin bên dưới để ứng tuyển nhanh
        </div>

        {/* ✅ Row 1 */}
        <div className="form-row">
          <input
            className="input-box"
            placeholder="Họ và tên"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            className="input-box"
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        {/* ✅ Row 2 */}
        <div className="form-row">
          <input
            className="input-box"
            placeholder="Tuổi"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />

          <input
            className="input-box"
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <select
          className="select-box"
          value={form.job_id}
          onChange={(e) => setForm({ ...form, job_id: e.target.value })}
        >
          <option value="">-- Chọn công việc --</option>
          {filteredJobs.map(job => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        {selectedJob && (
          <div className="jd-box">
            <div className="jd-header">
              📄 Job Description
            </div>

            <div className="jd-content">
              {selectedJob.description_raw}
            </div>
          </div>
        )}

        {/* ✅ CV CHOICE */}
        <div style={{ marginBottom: 15 }}>
          <p>Bạn có CV không?</p>

          <button
            className={`btn ${hasCV === true ? "btn-active" : "btn-inactive"}`}
            onClick={() => setHasCV(true)}
          >
            Có CV
          </button>

          <button
            className={`btn ${hasCV === false ? "btn-active" : "btn-inactive"}`}
            onClick={() => setHasCV(false)}
          >
            Chưa có CV
          </button>

        </div>

        {/* ✅ Upload */}
        {hasCV === true && (
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              setSelectedFile(e.target.files[0]);
            }}
          />
        )}

        {/* ✅ Questions */}
        {hasCV === false &&
          selectedJob?.questions?.length > 0 && (

            <div style={{ marginTop: 15 }}>

              {selectedJob.questions.map((question, index) => (


                <textarea
                  key={index}
                  className="textarea-box"
                  placeholder={question}
                  value={answers[index] || ""}
                  onChange={(e) => {

                    const updated = [...answers];

                    updated[index] = e.target.value;

                    setAnswers(updated);

                  }}
                />


              ))}

            </div>

          )}

        {/* ✅ BUTTON */}
        <div className="btn-group">
          <button className="btn btn-back" onClick={handleReset}>Reset</button>
          <button className="btn btn-submit" onClick={handleSubmit}>Nộp đơn</button>
        </div>

      </div>
    </div>
  );
}

export default ApplyForm;
