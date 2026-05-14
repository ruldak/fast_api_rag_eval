from jinja2 import Template
from app.models import MetricDefinition

PREDEFINED_TEMPLATES = {
    "faithfulness": """You are an expert evaluator. Evaluate whether the response is fully supported by the provided contexts.

Query: {{query}}
Response: {{response}}
Contexts:
{% for ctx in contexts %}
- {{ctx}}
{% endfor %}

Provide a score from 0.0 to 1.0 where 1.0 means fully supported.
Output only JSON: {"score": <float>, "reason": "<explanation>"}""",

    "answer_relevancy": """You are an expert evaluator. Evaluate how relevant the response is to the query.

Query: {{query}}
Response: {{response}}

Provide a score from 0.0 to 1.0 where 1.0 means perfectly relevant.
Output only JSON: {"score": <float>, "reason": "<explanation>"}""",

    "correctness": """You are an expert evaluator. Compare the response with the ground truth and evaluate correctness.

Query: {{query}}
Response: {{response}}
Ground Truth: {{ground_truth}}

Provide a score from 0.0 to 1.0 where 1.0 means perfectly correct.
Output only JSON: {"score": <float>, "reason": "<explanation>"}"""
}

class PromptBuilder:
    def build(self, metric: MetricDefinition, query: str, response: str, contexts: list, ground_truth: str = None):
        if metric.type == "predefined":
            template_str = PREDEFINED_TEMPLATES.get(metric.name, "")
        else:
            template_str = metric.config.get("prompt_template", "")
        
        template = Template(template_str)
        return template.render(
            query=query,
            response=response,
            contexts=contexts or [],
            ground_truth=ground_truth or ""
        )