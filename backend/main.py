from fastapi import FastAPI, Depends, HTTPException,BackgroundTasks, UploadFile, Form, File
from sqlalchemy.orm import Session
from groq import Groq
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer
import requests
import os
import re
from sqlalchemy.orm import joinedload
from typing import List, Optional
# Import các file nội bộ trong cùng folder backend
from database import engine, get_db
import models, schemas
from fastapi.middleware.cors import CORSMiddleware
from agents.langgraph_flow import run_langgraph_flow
from fastapi.staticfiles import StaticFiles
import uuid
import shutil
from PyPDF2 import PdfReader
from passlib.context import CryptContext
from auth import create_access_token
from fastapi import Header
def verify_token(
    authorization: str = Header(None)
):

    if authorization != f"Bearer {os.getenv('ADMIN_TOKEN')}":
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )
    
EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PHONE_REGEX = r'(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}'
GITHUB_REGEX = r'(https?://)?(www\.)?github\.com/[a-zA-Z0-9_-]+'
LINKEDIN_REGEX = r'(https?://)?(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+'
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tự động tạo bảng trong PostgreSQL nếu chưa tồn tại
models.Base.metadata.create_all(bind=engine)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads"
)


groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
embed_model = SentenceTransformer('all-MiniLM-L6-v2') 
llm = ChatGroq(
    model_name=os.getenv("MODEL_NAME", "llama-3.3-70b-versatile"), 
    temperature=0,
    groq_api_key=os.getenv("GROQ_API_KEY")
)

# 2. Ép LLM trả về đúng định dạng của Pydantic Schema
structured_llm = llm.with_structured_output(schemas.ExtractedFlexibleInfo)

def get_embedding(text):
    return embed_model.encode(text).tolist()

@app.get("/evaluations/", response_model=List[schemas.EvaluationResponse])
def get_evaluations(current_user=Depends(verify_token), db: Session = Depends(get_db)):
    evaluations = db.query(models.Evaluation)\
                    .options(joinedload(models.Evaluation.candidate))\
                    .all()
    return evaluations

def extract_text_from_pdf(file_path: str):
    reader = PdfReader(file_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    return text.strip()


def get_or_create_candidate(db: Session, name: str, phone: str, email: str):
    clean_email = email.strip().lower() if email else None

    candidate = None

    if clean_email:
        candidate = db.query(models.Candidate)\
            .filter(models.Candidate.email == clean_email)\
            .first()

    if candidate:
        candidate.full_name = name
        candidate.phone = phone
        db.commit()
        db.refresh(candidate)
        return candidate

    candidate = models.Candidate(
        full_name=name,
        phone=phone,
        email=clean_email
    )

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return candidate



def get_existing_evaluation(db: Session, candidate_id: int, job_id: int):
    return db.query(models.Evaluation)\
        .filter(
            models.Evaluation.candidate_id == candidate_id,
            models.Evaluation.job_id == job_id
        )\
        .first()
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)
def worker_ai_grading(evaluation_id: int, resume_text: str, job_description: str):
    from database import SessionLocal
    import models

    db = SessionLocal()

    try:
        evaluation = db.query(models.Evaluation)\
            .filter(models.Evaluation.id == evaluation_id)\
            .first()

        if not evaluation:
            print(f"Evaluation {evaluation_id} not found")
            return

        candidate_name = (
            evaluation.candidate.full_name
            if evaluation.candidate
            else "Candidate"
        )

        if not job_description:
            evaluation.score = None
            evaluation.summary = "⚠️ Resume chưa được map với job nào"
            evaluation.reason = "Cần HR assign job trước khi AI có thể đánh giá"
            evaluation.status = "Pending"
            db.commit()
            return

        # ✅ chỉ chạy AI khi có job
        ai_data = run_langgraph_flow(resume_text, job_description,candidate_name)

        if not isinstance(ai_data, dict):
            ai_data = ai_data.dict()

        if not ai_data:
            print("❌ Không có dữ liệu AI trả về")
            return

        def get_val(obj, key):
            return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)

        def get_email_fields(email_obj):
            if not email_obj:
                return "", ""
            if isinstance(email_obj, dict):
                return email_obj.get('subject', ''), email_obj.get('content', '')
            return getattr(email_obj, 'subject', ''), getattr(email_obj, 'content', '')

        score_val = get_val(ai_data, 'score')
        candidate_summary_val = get_val(ai_data, 'candidate_summary')
        strengths_val = get_val(ai_data, 'strengths')
        weaknesses_val = get_val(ai_data, 'weaknesses')
        recommendation_val = get_val(ai_data, 'recommendation')
        questions_list = get_val(ai_data, 'interview_questions') or []

        formatted_questions = "\n".join([f"- {q}" for q in questions_list])

        if evaluation:
            evaluation.score = int(score_val) if score_val is not None else None   # ✅ FIX

            evaluation.summary = (
                f"📌 THÔNG TIN NỀN TẢNG:\n{candidate_summary_val}\n\n"
                f"💪 CÁC THẾ MẠNH CỐT LÕI (STRENGTHS):\n{strengths_val}"
            )

            evaluation.reason = (
                f"❌ ĐIỂM THIẾU HỤT SO VỚI JD:\n{weaknesses_val}\n\n"
                f"📊 ĐÁNH GIÁ & ĐỀ XUẤT TỪ AI AGENT:\n{recommendation_val}\n\n"
                f"❓ 5 CÂU HỎI PHỎNG VẤN GỢI Ý:\n{formatted_questions}"
            )

            evaluation.status = "Pending"
            db.commit()

    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi: {str(e)}")

    finally:
        db.close()

@app.get("/jobs/", response_model=list[schemas.JobResponse])
def get_all_jobs(current_user=Depends(verify_token),db: Session = Depends(get_db)):
    try:
        return db.query(models.Job).order_by(models.Job.id.asc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/candidates/", response_model=schemas.EvaluationResponse)
def create_candidate_and_evaluate(
    background_tasks: BackgroundTasks,
    resume_text: str = Form(...),
    file_id: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        raw_text = resume_text 
        resume_url = file_id 
        email_match = re.search(EMAIL_REGEX, raw_text)
        phone_match = re.search(PHONE_REGEX, raw_text)
        github_match = re.search(GITHUB_REGEX, raw_text)
        linkedin_match = re.search(LINKEDIN_REGEX, raw_text)

        email = email_match.group(0) if email_match else None
        phone = phone_match.group(0) if phone_match else None
        github = github_match.group(0) if github_match else None
        linkedin = linkedin_match.group(0) if linkedin_match else None

        if not github and "GitHub" in raw_text:
            github = f"https://github.com/benluong"
        if not linkedin and "LinkedIn" in raw_text:
            linkedin = f"https://www.linkedin.com/in/ben-luong"

        prompt = f"Bạn là một trợ lý AI bóc tách hồ sơ tuyển dụng. Hãy phân tích đoạn văn bản CV dưới đây...\n\n{raw_text}"
        ai_info = structured_llm.invoke(prompt)

        candidate = db.query(models.Candidate).filter(models.Candidate.email == email).first()
        if not candidate:
            candidate = models.Candidate(
                full_name=ai_info.full_name,
                email=email,
                phone=phone,
                github=github,
                linkedin=linkedin,
                link_1=ai_info.link_1,
                link_2=ai_info.link_2,
                link_3=ai_info.link_3
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)

        resume_vector = get_embedding(raw_text)
        result = db.query(
            models.Job,
            models.Job.embedding.cosine_distance(resume_vector).label("distance")
        ).order_by("distance").first()

        best_job = result.Job
        distance = result.distance

        THRESHOLD = 0.5

        if distance > THRESHOLD:
            best_job = None

        new_evaluation = models.Evaluation(
            candidate_id=candidate.id,
            job_id=best_job.id if best_job else None,
            resume_text=raw_text,
            file_id=resume_url,
            status="Pending"
        )
        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

        background_tasks.add_task(
            worker_ai_grading,
            new_evaluation.id,
            raw_text,
            best_job.description_raw if best_job else ""
        )

        return new_evaluation

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/jobs/", response_model=schemas.JobResponse)
def create_job(job: schemas.JobCreate,current_user=Depends(verify_token), db: Session = Depends(get_db)):

    normalized_title = job.title.strip()

    existing = db.query(models.Job).filter(
        models.Job.title.ilike(normalized_title)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Job '{normalized_title}' already exists"
        )

    try:
        vector = get_embedding(job.description_raw)
        
        new_job = models.Job(
            title=normalized_title,
            description_raw=job.description_raw,
            embedding=vector,
            questions=job.questions
        )

        db.add(new_job)
        db.commit()
        db.refresh(new_job)

        return new_job

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/apply-with-cv", response_model=schemas.EvaluationResponse)
async def apply_with_cv(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    age: str = Form(""),
    phone: str = Form(...),
    email: str = Form(""),
    job_id: int = Form(...),
    resume_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        job = db.query(models.Job).filter(models.Job.id == job_id).first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if not resume_file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        file_content = await resume_file.read()
        MAX_FILE_SIZE = 5 * 1024 * 1024
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="PDF must be smaller than 5MB"
                )
        safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", resume_file.filename)
        filename = f"{uuid.uuid4()}_{safe_filename}"
        save_path = os.path.join(UPLOAD_DIR, filename)

        with open(save_path, "wb") as buffer:
            buffer.write(file_content)

        resume_path = f"/uploads/{filename}"

        pdf_text = extract_text_from_pdf(save_path)

        resume_text = f"""
Candidate Information:
Name: {name}
Age: {age}
Phone: {phone}
Email: {email}

Resume Content:
{pdf_text}
"""

        candidate = get_or_create_candidate(
            db=db,
            name=name,
            phone=phone,
            email=email
        )

        existing_evaluation = get_existing_evaluation(
            db=db,
            candidate_id=candidate.id,
            job_id=job.id
        )

        if existing_evaluation:
            existing_evaluation.resume_text = resume_text
            existing_evaluation.resume_path = resume_path
            existing_evaluation.answers = None
            existing_evaluation.file_id = None
            existing_evaluation.score = None
            existing_evaluation.summary = "⏳ AI đang đánh giá lại hồ sơ..."
            existing_evaluation.reason = "⏳ AI đang phân tích mức độ phù hợp với JD..."
            existing_evaluation.status = "Pending"

            db.commit()
            db.refresh(existing_evaluation)

            background_tasks.add_task(
                worker_ai_grading,
                existing_evaluation.id,
                resume_text,
                job.description_raw
            )

            return existing_evaluation

        new_evaluation = models.Evaluation(
            candidate_id=candidate.id,
            job_id=job.id,
            resume_text=resume_text,
            resume_path=resume_path,
            answers=None,
            file_id=None,
            status="Pending"
        )

        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

        background_tasks.add_task(
            worker_ai_grading,
            new_evaluation.id,
            resume_text,
            job.description_raw
        )

        return new_evaluation

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        print("❌ apply_with_cv error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/apply-without-cv", response_model=schemas.EvaluationResponse)
def apply_without_cv(
    payload: schemas.ApplyWithoutCV,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        job = db.query(models.Job)\
            .filter(models.Job.id == payload.job_id)\
            .first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        candidate = get_or_create_candidate(
            db=db,
            name=payload.name,
            phone=payload.phone,
            email=payload.email
        )

        application_text = ""

        for question, answer in zip(job.questions or [], payload.answers):
            application_text += f"""

QUESTION:
{question}

ANSWER:
{answer}

"""

        existing_evaluation = get_existing_evaluation(
            db=db,
            candidate_id=candidate.id,
            job_id=job.id
        )

        if existing_evaluation:
            existing_evaluation.resume_text = application_text
            existing_evaluation.answers = payload.answers
            existing_evaluation.resume_path = None
            existing_evaluation.file_id = None
            existing_evaluation.score = None
            existing_evaluation.summary = "⏳ AI đang đánh giá lại application form..."
            existing_evaluation.reason = "⏳ AI đang phân tích câu trả lời của ứng viên..."
            existing_evaluation.status = "Pending"

            db.commit()
            db.refresh(existing_evaluation)

            background_tasks.add_task(
                worker_ai_grading,
                existing_evaluation.id,
                application_text,
                job.description_raw
            )

            return existing_evaluation

        new_evaluation = models.Evaluation(
            candidate_id=candidate.id,
            job_id=job.id,
            resume_text=application_text,
            answers=payload.answers,
            resume_path=None,
            file_id=None,
            status="Pending"
        )

        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

        background_tasks.add_task(
            worker_ai_grading,
            new_evaluation.id,
            application_text,
            job.description_raw
        )

        return new_evaluation

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        print("❌ apply_without_cv error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
@app.put("/evaluations/{evaluation_id}/status")
def update_evaluation_status(
    evaluation_id: int,
    status: str,
    email_data: schemas.EmailForwardPayload,
    current_user=Depends(verify_token),
    db: Session = Depends(get_db)
):

    evaluation = (
        db.query(models.Evaluation)
        .filter(
            models.Evaluation.id == evaluation_id
        )
        .first()
    )

    if not evaluation:
        raise HTTPException(
            status_code=404,
            detail="Evaluation not found"
        )

    evaluation.status = status

    db.commit()

    try:

        n8n_url = os.getenv("N8N_URL")

        payload = {
            "candidate_email":
                email_data.candidate_email,

            "candidate_name":
                email_data.candidate_name,

            "subject":
                email_data.subject,

            "email_content":
                email_data.email_content
        }

        requests.post(
            n8n_url,
            json=payload,
            timeout=10
        )

        print("Email sent to n8n")

    except Exception as e:

        print(
            f"N8N ERROR: {str(e)}"
        )

    return {
        "message":
            "Status updated successfully"
    }
def rematch_single_evaluation(evaluation_id, job_id):
    from database import SessionLocal
    import numpy as np

    db = SessionLocal()

    try:
        eval = db.query(models.Evaluation).filter(models.Evaluation.id == evaluation_id).first()
        job = db.query(models.Job).filter(models.Job.id == job_id).first()

        if not eval or not job:
            return

        resume_vector = np.array(get_embedding(eval.resume_text))
        job_vector = np.array(job.embedding)

        similarity = np.dot(job_vector, resume_vector) / (
            np.linalg.norm(job_vector) * np.linalg.norm(resume_vector)
        )

        
        THRESHOLD = 0.3  # TEST trước

        if similarity < THRESHOLD:
            print(f"❌ Not matched: {similarity}")
            return

        print(f"✅ MATCHED: {similarity}")


        # ✅ match → assign job
        eval.job_id = job.id
        eval.status = "Pending"
        db.commit()

        # ✅ run AI
        worker_ai_grading(
            eval.id,
            eval.resume_text,
            job.description_raw
        )

    except Exception as e:
        print("❌ rematch error:", e)
        db.rollback()

    finally:
        db.close()

@app.post("/jobs/{job_id}/rematch-unmatched")
def rematch_unmatched(job_id: int, background_tasks: BackgroundTasks,current_user=Depends(verify_token), db: Session = Depends(get_db)):

    job = db.query(models.Job).filter(models.Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=400, detail="Job not found")

    # ✅ Lấy tất cả CV chưa match
    unmatched_evals = db.query(models.Evaluation)\
        .filter(models.Evaluation.job_id == None)\
        .all()

    for eval in unmatched_evals:
        background_tasks.add_task(
            rematch_single_evaluation,
            eval.id,
            job.id
        )

    return {"message": f"Re-matching {len(unmatched_evals)} resumes"}

@app.put("/jobs/{job_id}",response_model=schemas.JobResponse)
def update_job(job_id: int, job: schemas.JobCreate,current_user=Depends(verify_token), db: Session = Depends(get_db)):
    job_in_db = db.query(models.Job).filter(models.Job.id == job_id).first()

    if not job_in_db:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.query(models.Job)\
        .filter(models.Job.title.ilike(job.title.strip()), models.Job.id != job_id)\
        .first()

    if existing:
        raise HTTPException(400, "Job title already exists")

    job_in_db.title = job.title.strip()
    job_in_db.description_raw = job.description_raw
    job_in_db.embedding = get_embedding(job.description_raw)
    job_in_db.questions = job.questions
    db.commit()
    db.refresh(job_in_db)

    return job_in_db
@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):

    filename = f"{uuid.uuid4()}_{file.filename}"

    save_path = os.path.join(UPLOAD_DIR, filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "resume_path": f"/uploads/{filename}"
    }
@app.put("/evaluations/{evaluation_id}/assign-job")
def assign_job(
    evaluation_id: int,
    job_id: int,
    background_tasks: BackgroundTasks,
    current_user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    evaluation = db.query(models.Evaluation)\
        .filter(models.Evaluation.id == evaluation_id)\
        .first()

    if not evaluation:
        raise HTTPException(404, "Evaluation not found")

    job = db.query(models.Job)\
        .filter(models.Job.id == job_id)\
        .first()

    if not job:
        raise HTTPException(404, "Job not found")

    evaluation.job_id = job.id
    evaluation.status = "Pending"

    # reset dữ liệu cũ
    evaluation.score = None
    evaluation.summary = "⏳ AI đang đánh giá hồ sơ..."
    evaluation.reason = "⏳ AI đang phân tích mức độ phù hợp với JD..."

    db.commit()
    db.refresh(evaluation)

    background_tasks.add_task(
        worker_ai_grading,
        evaluation.id,
        evaluation.resume_text,
        job.description_raw
    )

    return {
        "message": "Job assigned successfully"
    }

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int,current_user=Depends(verify_token), db: Session = Depends(get_db)):

    job = db.query(models.Job).filter(models.Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    evaluations = db.query(models.Evaluation)\
        .filter(models.Evaluation.job_id == job_id)\
        .all()

    for eval in evaluations:
        eval.job_id = None  # ✅ chuyển về unmatched

    db.flush()  # ✅ đảm bảo update trước khi delete

    db.delete(job)
    db.commit()

    return {"message": "Job deleted successfully"}

@app.post("/login")
def login(payload: schemas.LoginRequest):

    if (
    payload.email == os.getenv("ADMIN_EMAIL")
    and
    payload.password == os.getenv("ADMIN_PASSWORD")
    ):

        return {
            "access_token":os.getenv("ADMIN_TOKEN"),
            "token_type":"bearer"
        }

    raise HTTPException(
        status_code=401,
        detail="Invalid credentials"
    )
@app.get("/public/jobs")
def get_public_jobs(
    db: Session = Depends(get_db)
):
    return (
        db.query(models.Job)
        .order_by(models.Job.id.asc())
        .all()
    )
