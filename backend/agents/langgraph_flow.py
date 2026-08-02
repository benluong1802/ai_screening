import os
from typing import TypedDict
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph
import schemas

llm = ChatGroq(
    model_name=os.getenv("MODEL_NAME", "llama-3.3-70b-versatile"),
    temperature=0,
    groq_api_key=os.getenv("GROQ_API_KEY")
)

    # ✅ State của toàn flow
class GraphState(TypedDict):
    resume_text: str
    job_description: str
    ai_data: dict
    candidate_name: str


    # ✅ Node 1: analyze + score (gộp để nhanh hơn)
def analyze_and_score(state: GraphState):
    structured_llm = llm.with_structured_output(schemas.EvaluationCore)
    
    prompt = f"""
    Bạn là chuyên gia HR.

    JD:
    {state['job_description']}

    THÔNG TIN ỨNG VIÊN:

    {state['resume_text']}

    Dữ liệu đầu vào có thể là:

    1. Resume CV

    HOẶC

    2. Câu trả lời từ Application Form

    QUY TẮC QUAN TRỌNG:

    - Chỉ sử dụng thông tin thực sự xuất hiện trong dữ liệu.
    - Không được suy đoán.
    - Nếu thiếu thông tin thì ghi rõ "Không đề cập".
    - Không tự tạo kinh nghiệm, học vấn hoặc bằng cấp.

    YÊU CẦU BẮT BUỘC:

    1. candidate_summary
    Tóm tắt:
    - học vấn (nếu có)
    - bằng cấp (nếu có)
    - kinh nghiệm (nếu có)
    - mục tiêu nghề nghiệp (nếu có)
    - các thông tin còn thiếu ghi "Không đề cập"

    2. strengths
    - các kỹ năng, kinh nghiệm hoặc câu trả lời phù hợp với JD

    3. weaknesses
    - các kỹ năng, kinh nghiệm hoặc yêu cầu còn thiếu so với JD

    4. score
    - thang điểm 0-100
    - chỉ chấm dựa trên dữ liệu thực tế
    - trừ điểm khi thiếu thông tin quan trọng

    5. recommendation
    - score < 75 → "LOẠI HỒ SƠ"
    - score >= 75 → "ĐỀ XUẤT PHỎNG VẤN"

    6. interview_questions
    - CHÍNH XÁC 5 câu
    - tập trung vào các điểm còn thiếu hoặc chưa rõ

    Trả JSON đúng schema.
    """


    result = structured_llm.invoke(prompt)

    return {"ai_data": result}


# ✅ Node 2: viết email
# def write_email(state: GraphState):
#     structured_llm = llm.with_structured_output(schemas.AIResponseEvaluation)

#     prompt = f"""
#     Tên ứng viên:
#     {state['candidate_name']}

#     Dựa trên kết quả đánh giá:

#     {state['ai_data']}

#     YÊU CẦU:

#     - Email phải gọi đúng tên ứng viên
#     - Không dùng placeholder
#     - Giọng văn chuyên nghiệp
#     - Định dạng HTML
#     - Có lời chào
#     - Có lời kết
#     - Có chữ ký The Grand Ho Tram

#     Approval email:
#     - Chúc mừng ứng viên
#     - Thể hiện đánh giá tích cực
#     - Mời tham gia vòng tiếp theo

#     Rejection email:
#     - Lịch sự
#     - Tôn trọng
#     - Không làm ứng viên cảm thấy bị xúc phạm
#     - Khuyến khích ứng tuyển trong tương lai

#     Trả về JSON đúng schema.
#     """

#     result = structured_llm.invoke(prompt)

#     return {"ai_data": result}


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("analyze_score", analyze_and_score)
    # graph.add_node("email", write_email)

    graph.set_entry_point("analyze_score")
    # graph.add_edge("analyze_score", "email")

    return graph.compile()


def run_langgraph_flow(resume_text: str, job_description: str, candidate_name:str):
    app = build_graph()

    result = app.invoke({
        "resume_text": resume_text,
        "job_description": job_description,
        "candidate_name": candidate_name
    })

    return result["ai_data"]