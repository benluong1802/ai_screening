from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from typing import List

class JobCreate(BaseModel):
    title: str
    description_raw: str
    questions: Optional[List[str]] = []

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class JobResponse(BaseModel):
    id: int
    title: str
    description_raw: str
    created_at: datetime
    questions: Optional[List[str]]
    class Config:
        from_attributes = True

class CandidateResponse(BaseModel):
    id: int
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    github: Optional[str]
    linkedin: Optional[str]
    link_1: Optional[str]
    link_2: Optional[str]
    link_3: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class CandidateCreate(BaseModel):
    resume_text: str
    resume_path: Optional[str] = None

class ExtractedFlexibleInfo(BaseModel):
    full_name: str = Field(description="Họ và tên đầy đủ của ứng viên")
    link_1: Optional[str] = Field(default=None, description="Đường link portfolio/blog/website thứ nhất của ứng viên (NẾU CÓ).")
    link_2: Optional[str] = Field(default=None, description="Đường link portfolio/blog/website thứ hai của ứng viên (NẾU CÓ).")
    link_3: Optional[str] = Field(default=None, description="Đường link portfolio/blog/website thứ ba của ứng viên (NẾU CÓ).")

class EmailForwardPayload(BaseModel):
    candidate_email: str
    candidate_name: str
    subject: str
    email_content: str

class EvaluationResponse(BaseModel):
    id: int
    candidate_id: int
    job_id: Optional[int]
    score: Optional[float]
    summary: Optional[str]
    reason: Optional[str]
    status: str
    created_at: datetime
    resume_path: Optional[str] = None
    candidate: Optional[CandidateResponse] = None
    answers: Optional[List[str]] = None
    class Config:
        from_attributes = True

class EvaluationCore(BaseModel):
    score: int = Field(..., description="Điểm số từ 0 đến 100")
    candidate_summary: str = Field(..., description="Tóm tắt ứng viên")
    strengths: str = Field(..., description="Điểm mạnh")
    weaknesses: str = Field(..., description="Điểm yếu")
    recommendation: str = Field(..., description="Đề xuất phỏng vấn hoặc loại")
    interview_questions: List[str] = Field(..., description="5 câu hỏi phỏng vấn")

class ApplyWithoutCV(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    job_id: int
    answers: List[str]