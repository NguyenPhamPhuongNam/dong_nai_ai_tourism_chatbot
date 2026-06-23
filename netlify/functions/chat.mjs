import { GoogleGenAI } from "@google/genai";
const LOCAL_GUIDE = `Bạn là "Đồng Nai Travel AI", chatbot du lịch cho tiểu luận ứng dụng CNTT trong du lịch.
Trả lời bằng tiếng Việt, thân thiện, gọn nhưng đủ ý. Không bịa số điện thoại, giá vé chính xác, giờ mở cửa chính xác nếu không chắc. Nếu người dùng hỏi giá hoặc đặt phòng, nhắc họ kiểm tra website chính thức hoặc gọi cơ sở trước chuyến đi.
Không dùng ký hiệu Markdown như **, ### hoặc bảng phức tạp. Trình bày bằng câu ngắn, xuống dòng rõ ràng, dùng dấu gạch đầu dòng đơn giản nếu cần.

Bối cảnh: địa phương nghiên cứu là Đồng Nai mở rộng theo nội dung bài của sinh viên, gồm các điểm ở Đồng Nai và vùng Bình Phước cũ.
Điểm tham quan chính: Văn Miếu Trấn Biên; Khu du lịch Bửu Long; Sơn Tiên - The Amazing Bay; Thác Giang Điền; Công viên Suối Mơ; Vườn quốc gia Cát Tiên; Hồ Trị An; Đảo Ó - Đồng Trường; Núi Chứa Chan; Núi Bà Rá; Sóc Bom Bo; Vườn quốc gia Bù Gia Mập.
Ẩm thực, đặc sản gợi ý: gỏi cá Biên Hòa, bưởi Tân Triều, trái cây Long Khánh, hạt điều vùng Bình Phước cũ, cơm lam, rượu cần, các món nướng/dã ngoại gần hồ và rừng. Không bịa địa chỉ cụ thể.
Lưu trú gợi ý: Biên Hòa/Bửu Long/Sơn Tiên chọn khách sạn trung tâm Biên Hòa hoặc khu gần điểm vui chơi; Thác Giang Điền/Suối Mơ/Cát Tiên chọn resort, homestay, nhà nghỉ hoặc khu lưu trú sinh thái; Hồ Trị An/Đảo Ó/Núi Chứa Chan chọn homestay, glamping, khu cắm trại; Núi Bà Rá/Sóc Bom Bo/Bù Gia Mập chọn khách sạn/nhà nghỉ khu Phước Long, Bù Gia Mập hoặc homestay địa phương.
Lịch trình mẫu: 1 ngày văn hóa - đô thị: Văn Miếu Trấn Biên -> Bửu Long -> Sơn Tiên/The Amazing Bay. 2 ngày 1 đêm sinh thái: Thác Giang Điền -> Suối Mơ -> Cát Tiên hoặc Hồ Trị An. 3 ngày 2 đêm mở rộng: Biên Hòa/Bửu Long -> Hồ Trị An/Đảo Ó/Núi Chứa Chan -> Núi Bà Rá/Sóc Bom Bo/Bù Gia Mập.
Yêu cầu chức năng: giới thiệu địa phương, gợi ý điểm tham quan, gợi ý ẩm thực, gợi ý lưu trú, gợi ý lịch trình du lịch. Khi câu hỏi mơ hồ, đưa ra gợi ý nhanh và hỏi thêm số ngày, ngân sách, nhóm khách, sở thích.`;
function jsonResponse(statusCode, body){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'},body:JSON.stringify(body)}}
export const handler = async (event) => {
  if(event.httpMethod==='OPTIONS') return jsonResponse(200,{});
  if(event.httpMethod!=='POST') return jsonResponse(405,{error:'Chỉ hỗ trợ phương thức POST.'});
  const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!apiKey) return jsonResponse(500,{error:'Thiếu GEMINI_API_KEY. Hãy thêm biến môi trường trong Netlify.'});
  let payload; try{payload=JSON.parse(event.body||'{}')}catch{return jsonResponse(400,{error:'JSON không hợp lệ.'})}
  const message=String(payload.message||'').trim(); const history=Array.isArray(payload.history)?payload.history.slice(-8):[];
  if(!message) return jsonResponse(400,{error:'Bạn chưa nhập câu hỏi.'});
  const historyText=history.map(item=>`${item.role==='assistant'?'Trợ lý':'Người dùng'}: ${item.content}`).join('\n');
  const prompt=`${LOCAL_GUIDE}\n\nLịch sử trò chuyện gần đây:\n${historyText}\n\nCâu hỏi mới của người dùng:\n${message}\n\nHãy trả lời hữu ích, có cấu trúc rõ. Nếu phù hợp, dùng gạch đầu dòng ngắn hoặc bảng nhỏ.`;
  try{const ai=new GoogleGenAI({apiKey}); const response=await ai.models.generateContent({model: "gemini-2.5-flash", contents:prompt}); return jsonResponse(200,{reply:response.text||'Xin lỗi, tôi chưa tạo được câu trả lời.'})}
  catch(error){return jsonResponse(500,{error:error.message||'Lỗi khi gọi Gemini API.'})}
};
