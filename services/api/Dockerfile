FROM continuumio/miniconda3:24.7.1-0

WORKDIR /app

COPY environment.yml .
RUN conda env create -f environment.yml && conda clean -afy

ENV PATH="/opt/conda/envs/nexus-api/bin:$PATH"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]