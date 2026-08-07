import os

import streamlit as st
from elevenlabs.client import ElevenLabs
from pypdf import PdfReader


DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
MODEL_ID = "eleven_flash_v2_5"
OUTPUT_FORMAT = "mp3_44100_128"


st.title("Spyder: AI Audiobook Generator")
st.subheader("Convert lecture notes and PDFs into realistic audio on the fly.")

uploaded_file = st.file_uploader(
    "Upload a PDF to turn into audio",
    type=["pdf"],
)

if st.button("Generate Audiobook", type="primary"):
    if uploaded_file is None:
        st.error("Please upload a PDF first.")
    else:
        try:
            reader = PdfReader(uploaded_file)
            if not reader.pages:
                st.error("The uploaded PDF does not contain any pages.")
            else:
                text = reader.pages[0].extract_text() or ""
                if not text.strip():
                    st.error("The first page of the PDF does not contain readable text.")
                else:
                    api_key = os.environ.get("ELEVENLABS_API_KEY")
                    if not api_key:
                        st.error(
                            "ElevenLabs is not configured. Add ELEVENLABS_API_KEY "
                            "to the environment and try again."
                        )
                    else:
                        client = ElevenLabs(api_key=api_key)
                        with st.spinner("Synthesizing audio..."):
                            audio_response = client.text_to_speech.convert(
                                voice_id=DEFAULT_VOICE_ID,
                                text=text,
                                model_id=MODEL_ID,
                                output_format=OUTPUT_FORMAT,
                            )
                            audio_bytes = (
                                audio_response
                                if isinstance(audio_response, bytes)
                                else b"".join(audio_response)
                            )

                        st.audio(audio_bytes, format="audio/mp3")
                        st.success("Audiobook generated successfully.")
        except Exception as error:
            st.error(f"Unable to generate the audiobook: {error}")
