from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from database import Base
from sqlalchemy import JSON
class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description_raw = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    questions = Column(JSON, nullable=True)
    evaluations = relationship("Evaluation", back_populates="job")
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String(255), unique=True)

    password_hash = Column(String(255))

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    phone = Column(String(50), nullable=True)
    github = Column(String(255), nullable=True)
    linkedin = Column(String(255), nullable=True)
    link_1 = Column(String(255), nullable=True)
    link_2 = Column(String(255), nullable=True)
    link_3 = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    evaluations = relationship("Evaluation", back_populates="candidate", cascade="all, delete-orphan")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    job_id = Column(Integer, ForeignKey("jobs.id"))
    resume_text = Column(String)
    score = Column(Integer, nullable=True)
    summary = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    status = Column(String, default="Pending")
    file_id = Column(String, nullable=True)
    resume_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    answers = Column(JSON, nullable=True)
    job = relationship("Job", back_populates="evaluations")
    candidate = relationship("Candidate", back_populates="evaluations")
