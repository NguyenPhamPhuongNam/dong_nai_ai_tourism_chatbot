import { GoogleGenAI } from "@google/genai";

const LOCAL_GUIDE = `Bạn là "Đồng Nai Travel AI", chatbot du lịch cho tiểu luận ứng dụng CNTT trong du lịch.

Trả lời bằng tiếng Việt, thân thiện, gọn nhưng đủ ý.
Không bịa số điện thoại, giá vé chính xác, giờ mở cửa chính xác nếu không chắc.
Nếu người dùng hỏi giá hoặc đặt phòng, nhắc họ kiểm tra website chính thức hoặc gọi cơ sở trước chuyến đi.
Không dùng ký hiệu Markdown như **, ### hoặc bảng phức tạp.
Trình bày bằng câu ngắn, xuống dòng rõ ràng, dùng dấu gạch đầu dòng đơn giản nếu cần.

Bối cảnh:
Địa phương nghiên cứu là Đồng Nai mở rộng theo nội dung bài của sinh viên, gồm các điểm ở Đồng Nai và vùng Bình Phước cũ.

Điểm tham quan chính:
Văn Miếu Trấn Biên; Khu du lịch Bửu Long; Sơn Tiên - The Amazing Bay; Thác Giang Điền; Công viên Suối Mơ; Vườn quốc gia Cát Tiên; Hồ Trị An; Đảo Ó - Đồng Trường; Núi Chứa Chan; Núi Bà Rá; Sóc Bom Bo; Vườn quốc gia Bù Gia Mập.

Ẩm thực, đặc sản gợi ý:
Gỏi cá Biên Hòa, bưởi Tân Triều, trái cây Long Khánh, hạt điều vùng Bình Phước cũ, cơm lam, rượu cần, các món nướng hoặc dã ngoại gần hồ và rừng.
Không bịa địa chỉ cụ thể.

Lưu trú gợi ý:
Biên Hòa, Bửu Long, Sơn Tiên: chọn khách sạn trung tâm Biên Hòa hoặc khu gần điểm vui chơi.
Thác Giang Điền, Suối Mơ, Cát Tiên: chọn resort, homestay, nhà nghỉ hoặc khu lưu trú sinh thái.
Hồ Trị An, Đảo Ó, Núi Chứa Chan: chọn homestay, glamping, khu cắm trại.
Núi Bà Rá, Sóc Bom Bo, Bù Gia Mập: chọn khách sạn, nhà nghỉ khu Phước Long, Bù Gia Mập hoặc homestay địa phương.

Lịch trình mẫu:
1 ngày văn hóa - đô thị: Văn Miếu Trấn Biên -> Bửu Long -> Sơn Tiên/The Amazing Bay.
2 ngày 1 đêm sinh thái: Thác Giang Điền -> Suối Mơ -> Cát Tiên hoặc Hồ Trị An.
3 ngày 2 đêm mở rộng: Biên Hòa/Bửu Long -> Hồ Trị An/Đảo Ó/Núi Chứa Chan -> Núi Bà Rá/Sóc Bom Bo/Bù Gia Mập.

Yêu cầu chức năng:
Có thể giới thiệu địa phương.
Có thể gợi ý điểm tham quan.
Có thể gợi ý ẩm thực.
Có thể gợi ý lưu trú.
Có thể gợi ý lịch trình du lịch.
Khi câu hỏi mơ hồ, đưa ra gợi ý nhanh và hỏi thêm số ngày, ngân sách, nhóm khách, sở thích.`;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelList() {
  const envModels = (process.env.GEMINI_MODELS || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (envModels.length > 0) {
    return envModels;
  }

  return [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash"
  ];
}

function isTemporaryGeminiError(error) {
  const message = String(error?.message || error || "");

  return (
    message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand") ||
    message.includes("temporarily") ||
    message.includes("overloaded") ||
    message.includes("try again later")
  );
}

function isSkippableModelError(error) {
  const message = String(error?.message || error || "");

  return (
    isTemporaryGeminiError(error) ||
    message.includes("model") ||
    message.includes("not found") ||
    message.includes("NOT_FOUND") ||
    message.includes("not supported") ||
    message.includes("unsupported")
  );
}

function makeFriendlyError(error) {
  const message = String(error?.message || error || "");

  if (isTemporaryGeminiError(error)) {
    return "Model Gemini đang quá tải tạm thời. Vui lòng đợi một lát rồi thử lại.";
  }

  if (
    message.includes("API key") ||
    message.includes("INVALID_ARGUMENT") ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "API key chưa hợp lệ hoặc chưa có quyền gọi Gemini API. Hãy kiểm tra lại GEMINI_API_KEY trong Netlify.";
  }

  if (
    message.includes("model") ||
    message.includes("not found") ||
    message.includes("NOT_FOUND")
  ) {
    return "Model Gemini đang dùng không hợp lệ hoặc chưa được hỗ trợ. Hãy đổi danh sách model trong GEMINI_MODELS.";
  }

  return message || "Lỗi khi gọi Gemini API.";
}

async function generateWithFallback(ai, prompt) {
  const models = getModelList();
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt
        });

        return {
          text: response.text || "Xin lỗi, tôi chưa tạo được câu trả lời.",
          model
        };
      } catch (error) {
        lastError = error;

        if (!isSkippableModelError(error)) {
          throw error;
        }

        if (attempt < 2) {
          await sleep(700);
        }
      }
    }
  }

  throw lastError;
}

function getLocalFallbackAnswer(message) {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("giới thiệu") ||
    text.includes("tong quan") ||
    text.includes("tổng quan") ||
    text.includes("địa phương")
  ) {
    return `Đồng Nai mở rộng là điểm đến kết hợp giữa văn hóa, sinh thái, vui chơi giải trí và trải nghiệm địa phương.

Các điểm nổi bật gồm:
- Văn Miếu Trấn Biên, Bửu Long và Sơn Tiên ở khu vực Biên Hòa.
- Thác Giang Điền, Suối Mơ, Cát Tiên, Hồ Trị An, Đảo Ó và Núi Chứa Chan.
- Núi Bà Rá, Sóc Bom Bo và Vườn quốc gia Bù Gia Mập thuộc vùng Bình Phước cũ.

Đây là địa phương phù hợp cho chuyến đi 1 ngày, 2 ngày 1 đêm hoặc 3 ngày 2 đêm.`;
  }

  if (
    text.includes("tham quan") ||
    text.includes("điểm đến") ||
    text.includes("địa điểm") ||
    text.includes("chơi")
  ) {
    return `Một số điểm tham quan tiêu biểu ở Đồng Nai mở rộng:

- Văn Miếu Trấn Biên: tìm hiểu văn hóa và lịch sử.
- Khu du lịch Bửu Long: hồ nước, núi đá, cảnh quan chụp ảnh.
- Sơn Tiên - The Amazing Bay: vui chơi, công viên nước.
- Thác Giang Điền và Suối Mơ: sinh thái, dã ngoại.
- Cát Tiên và Bù Gia Mập: khám phá rừng.
- Hồ Trị An, Đảo Ó và Núi Chứa Chan: ngắm cảnh, cắm trại, leo núi.
- Núi Bà Rá và Sóc Bom Bo: cảnh quan và văn hóa vùng Bình Phước cũ.`;
  }

  if (
    text.includes("ẩm thực") ||
    text.includes("món ăn") ||
    text.includes("đặc sản") ||
    text.includes("ăn gì")
  ) {
    return `Gợi ý ẩm thực và đặc sản nên thử:

- Gỏi cá Biên Hòa.
- Bưởi Tân Triều.
- Trái cây Long Khánh.
- Hạt điều vùng Bình Phước cũ.
- Cơm lam, rượu cần và các món nướng dã ngoại.

Khi đi khu vực hồ, rừng hoặc cắm trại, du khách nên chuẩn bị đồ ăn nhẹ, nước uống và kiểm tra quy định của điểm tham quan trước chuyến đi.`;
  }

  if (
    text.includes("lưu trú") ||
    text.includes("khách sạn") ||
    text.includes("homestay") ||
    text.includes("nghỉ ở đâu") ||
    text.includes("ở đâu")
  ) {
    return `Gợi ý khu vực lưu trú:

- Đi 1 ngày ở Biên Hòa, Bửu Long, Sơn Tiên: có thể chọn khách sạn trung tâm Biên Hòa.
- Đi Thác Giang Điền, Suối Mơ, Cát Tiên: chọn homestay, resort hoặc khu lưu trú sinh thái gần điểm tham quan.
- Đi Hồ Trị An, Đảo Ó, Núi Chứa Chan: chọn homestay, glamping hoặc khu cắm trại.
- Đi Núi Bà Rá, Sóc Bom Bo, Bù Gia Mập: chọn nhà nghỉ, khách sạn ở khu Phước Long, Bù Gia Mập hoặc homestay địa phương.

Nên kiểm tra giá, đánh giá mới nhất và tình trạng phòng trước khi đặt.`;
  }

  if (
    text.includes("lịch trình") ||
    text.includes("3 ngày") ||
    text.includes("2 ngày") ||
    text.includes("1 ngày") ||
    text.includes("itinerary")
  ) {
    return `Gợi ý lịch trình 3 ngày 2 đêm Đồng Nai mở rộng:

Ngày 1: Biên Hòa - Bửu Long - Hồ Trị An
- Sáng tham quan Văn Miếu Trấn Biên.
- Trưa ghé Khu du lịch Bửu Long.
- Chiều di chuyển đến Hồ Trị An, ngắm hoàng hôn hoặc cắm trại nếu phù hợp.

Ngày 2: Cát Tiên - Núi Bà Rá
- Sáng khám phá Vườn quốc gia Cát Tiên.
- Chiều di chuyển về khu vực Núi Bà Rá.
- Tối nghỉ tại Phước Long hoặc khu vực lân cận.

Ngày 3: Sóc Bom Bo - Bù Gia Mập
- Sáng tìm hiểu không gian văn hóa Sóc Bom Bo.
- Trưa tham quan hoặc tìm hiểu Vườn quốc gia Bù Gia Mập.
- Chiều kết thúc hành trình.

Lịch trình có thể điều chỉnh tùy thời gian, sức khỏe, phương tiện và thời tiết.`;
  }

  return `Hiện model Gemini có thể đang quá tải tạm thời. Bạn có thể hỏi lại theo một trong các nhóm sau:
- Giới thiệu địa phương.
- Gợi ý điểm tham quan.
- Gợi ý ẩm thực.
- Gợi ý lưu trú.
- Gợi ý lịch trình du lịch.`;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Chỉ hỗ trợ phương thức POST."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, {
      error: "Thiếu GEMINI_API_KEY. Hãy thêm biến môi trường trong Netlify."
    });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      error: "JSON không hợp lệ."
    });
  }

  const message = String(payload.message || "").trim();
  const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];

  if (!message) {
    return jsonResponse(400, {
      error: "Bạn chưa nhập câu hỏi."
    });
  }

  const historyText = history
    .map((item) => `${item.role === "assistant" ? "Trợ lý" : "Người dùng"}: ${item.content}`)
    .join("\n");

  const prompt = `${LOCAL_GUIDE}

Lịch sử trò chuyện gần đây:
${historyText}

Câu hỏi mới của người dùng:
${message}

Hãy trả lời hữu ích, có cấu trúc rõ.
Không dùng Markdown phức tạp.
Không dùng bảng.
Dùng câu ngắn và gạch đầu dòng đơn giản nếu cần.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await generateWithFallback(ai, prompt);

    return jsonResponse(200, {
      reply: result.text,
      model: result.model
    });
  } catch (error) {
    const fallback = getLocalFallbackAnswer(message);

    if (fallback) {
      return jsonResponse(200, {
        reply: fallback,
        model: "local-fallback"
      });
    }

    return jsonResponse(500, {
      error: makeFriendlyError(error)
    });
  }
};
