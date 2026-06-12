import google.generativeai as genai
import os

print("GEMINI_API_KEY env var:", os.environ.get("GEMINI_API_KEY") is not None)
print("GOOGLE_APPLICATION_CREDENTIALS env var:", os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))

# Try to list models or generate a simple response
try:
    # If GEMINI_API_KEY is not set, we can try to configure it if we find one, or just try to use default
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content("Hola, di 'Conectado exitosamente con Gemini' si recibes esto.")
    print("Response:", response.text.strip())
except Exception as e:
    print("Error calling Gemini API:", str(e))
