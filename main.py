import os
import io
import uuid
import streamlit as st
from pypdf import PdfReader
from elevenlabs.client import ElevenLabs
from supabase import create_client, Client

# ==========================================
# 1. PAGE CONFIG & SPYDER BRANDING (UI)
# ==========================================
st.set_page_config(
    page_title="SPYDER - AI Audiobook Generator",
    page_icon="🎧",
    layout="centered"
)

# Psychedelic Purple & OLED Dark Theme Styling
st.markdown("""
    <style>
    .stApp {
        background-color: #09090C;
        color: #F4F4F6;
    }
    .stButton>button {
        background-color: #DF00FF !important;
        color: #FFFFFF !important;
        font-weight: bold !important;
        border-radius: 8px !important;
        border: none !important;
        padding: 0.6rem 1.2rem !important;
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        box-shadow: 0 0 15px #DF00FF;
        transform: scale(1.02);
    }
    h1, h2, h3 {
        color: #FFFFFF !important;
    }
    .stFileUploader {
        background-color: #16161D;
        border-radius: 10px;
        padding: 15px;
        border: 1px solid #2B2B36;
    }
    </style>
""", unsafe_allow_html=True)

st.title("⚡ SPYDER")
st.caption("Out-listen the class. Convert study notes & PDFs into high-fidelity audio.")

# ==========================================
# 2. CLIENT INITIALIZATION
# ==========================================
elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

if not elevenlabs_key or not supabase_url or not supabase_key:
    st.error("Missing API Keys! Ensure ELEVENLABS_API_KEY, SUPABASE_URL, and SUPABASE_KEY are saved in Replit Secrets.")
    st.stop()

eleven_client = ElevenLabs(api_key=elevenlabs_key)
supabase: Client = create_client(supabase_url, supabase_key)

# ==========================================
# 3. HELPER FUNCTIONS
# ==========================================
def extract_text_from_pdf(pdf_file) -> str:
    """Extracts text content from an uploaded PDF file."""
    reader = PdfReader(pdf_file)
    extracted_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            extracted_text += text + "\n"
    return extracted_text.strip()

def upload_to_supabase_storage(file_bytes: bytes, filename: str) -> str:
    """Uploads MP3 bytes to the Supabase 'audiobooks' bucket and returns the public URL."""
    storage_path = f"public/{uuid.uuid4()}_{filename}"
    
    # Upload to Supabase Storage
    supabase.storage.from_("audiobooks").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "audio/mpeg"}
    )
    
    # Retrieve public streaming URL
    public_url = supabase.storage.from_("audiobooks").get_public_url(storage_path)
    return public_url

def log_audiobook_to_db(title: str, audio_url: str, file_size: int):
    """Inserts a record into the 'audiobooks' database table."""
    dummy_user_id = "00000000-0000-0000-0000-000000000000" 
    
    data = {
        "user_id": dummy_user_id,
        "title": title,
        "audio_file_url": audio_url,
        "file_size_bytes": file_size
    }
    
    try:
        supabase.table("audiobooks").insert(data).execute()
    except Exception as e:
        pass

# ==========================================
# 4. APP INTERFACE & PIPELINE
# ==========================================
uploaded_file = st.file_uploader("Upload a PDF to synthesize", type=["pdf"])

if uploaded_file is not None:
    st.success(f"File attached: **{uploaded_file.name}** ({round(uploaded_file.size / 1024, 1)} KB)")
    
    if st.button("Generate Audiobook 🎧"):
        with st.status("Processing document...", expanded=True) as status:
            # Step 1: Extract Text
            st.write("📄 Extracting PDF text...")
            raw_text = extract_text_from_pdf(uploaded_file)
            
            if not raw_text:
                st.error("Could not extract readable text from this PDF.")
                st.stop()
            
            input_text = raw_text[:4000]
            
            # Step 2: ElevenLabs Synthesis
            st.write("🗣️ Synthesizing voice with ElevenLabs...")
            audio_generator = eleven_client.generate(
                text=input_text,
                voice="George",
                model="eleven_flash_v2_5"
            )
            
            audio_bytes = b"".join(audio_generator)
            
            # Step 3: Cloud Upload
            st.write("☁️ Uploading MP3 to Supabase Cloud Storage...")
            clean_filename = uploaded_file.name.replace(".pdf", ".mp3").replace(" ", "_")
            public_audio_url = upload_to_supabase_storage(audio_bytes, clean_filename)
            
            # Step 4: Database Logging
            st.write("🗄️ Logging metadata into Supabase Database...")
            log_audiobook_to_db(uploaded_file.name, public_audio_url, len(audio_bytes))
            
            status.update(label="Audiobook Generation Complete!", state="complete", expanded=False)
        
        # Step 5: Render Audio Player & Cloud Link
        st.subheader("Your Audiobook")
        st.audio(public_audio_url, format="audio/mp3")
        st.markdown(f"🔗 **Cloud Streaming Link:** [{public_audio_url}]({public_audio_url})")
