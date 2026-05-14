import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    api_key_hash = Column(String(64), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    runs = relationship("EvaluationRun", back_populates="tenant")
    metrics = relationship("MetricDefinition", back_populates="tenant")

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    status = Column(String(20), default="pending")
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    tenant = relationship("Tenant", back_populates="runs")
    items = relationship("EvaluationItem", back_populates="run", cascade="all, delete-orphan")

class EvaluationItem(Base):
    __tablename__ = "evaluation_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("evaluation_runs.id"), nullable=False)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    contexts = Column(JSON, default=list)
    ground_truth = Column(Text, nullable=True)
    payload_raw = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    run = relationship("EvaluationRun", back_populates="items")
    scores = relationship("Score", back_populates="item", cascade="all, delete-orphan")

class MetricDefinition(Base):
    __tablename__ = "metric_definitions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('tenant_id', 'name', name='uix_tenant_metric_name'),)
    
    tenant = relationship("Tenant", back_populates="metrics")
    scores = relationship("Score", back_populates="metric")

class Score(Base):
    __tablename__ = "scores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), ForeignKey("evaluation_items.id"), nullable=False)
    metric_id = Column(UUID(as_uuid=True), ForeignKey("metric_definitions.id"), nullable=False)
    value = Column(Float, nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    item = relationship("EvaluationItem", back_populates="scores")
    metric = relationship("MetricDefinition", back_populates="scores")