# DEBUG: Final AI Prompt

> **Generated**: 2026-04-09T00:59:10.897Z
> **Role**: completeness-assessor
> **Iteration**: unknown
> **Total Characters**: 8242

---

## Previous Iteration Summary

The following is a summary of what was accomplished in the previous iteration:

## QA Iteration 1 Results

- unit tests: 101/101 passed (0 failed, 100.0%)
- integration tests: 101/101 passed (0 failed, 100.0%)

**Total: 202/202 passed (100.0%)**

**QA gate: PASS** (target: 95%)

Full test output: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa/iteration-1/test-results/`


**Use this context to understand what has already been done and what remains.**

---
You are performing a comprehensive completeness assessment for Issue #1.

## Assessment Overview

**Primary Issue**: #1 (mananb77/kanban-test-1)
**Latest Iteration**: 4
**Analysis Scope**: code_and_docs
**Reference Documents**: 5
**Secondary Issues**: 0

---

## Reference Documents To Read

**CRITICAL**: You MUST read ALL 5 reference document(s) COMPLETELY before starting the assessment.

**Use the Read tool to read each file in its entirety:**

1. **P7 - QA**: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa/iteration-1`
2. **P3 - DEVELOPMENT**: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/dev/iteration-4`
3. **P2 - ARCHITECTURE**: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/arch/iteration-5`
4. **P6 - QA DEV**: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-dev/iteration-3`
5. **P8 - QA REVIEW**: `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-review/iteration-3`

**Instructions:**
1. Read EVERY document listed above using the Read tool
2. Read each document COMPLETELY - do not skip sections
3. Extract ALL requirements from the TDD and PRD
4. Cross-reference requirements with implementation code
5. Only after reading ALL documents, begin the assessment

---










## Your Task

You MUST perform a comprehensive completeness assessment following the methodology in your role prompt.

### Workspace Structure

```
/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/
  └── issue-1/
      ├── repos/
      │   └── mananb77/kanban-test-1/   # ← Implementation code here
      └── external-memory/
          ├── iteration-1/
          ├── iteration-2/
          ├── ...
          ├── iteration-4/
          └── completeness-assessment/      # ← Your artifacts go here (YOU WILL CREATE)
```

### Analysis Scope Instructions

**Current scope**: `code_and_docs`


- ✅ Analyze implementation code in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1`
- ✅ Analyze documentation in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory`
- ✅ Cross-reference code with documentation
- ✅ Verify documentation matches implementation


### Required Steps

1. **Read Requirements**
   - Read all reference documents provided above
   - Extract explicit and implicit requirements
   - Identify acceptance criteria
   - If no reference docs: search for PRD/TDD in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory`

2. **Analyze Implementation**
   - Read implementation code in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1`
   - Review all iteration artifacts in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/iteration-*`
   - Check test coverage and quality
   - Examine configuration and deployment files

3. **Perform Gap Analysis**
   - Map requirements to implementation artifacts
   - Identify missing features
   - Find incomplete implementations
   - Detect deviations from specifications

4. **Calculate Completeness**
   - Requirement coverage percentage
   - Implementation quality score
   - Documentation completeness score
   - Test coverage percentage
   - Overall completeness rating

5. **Create Assessment Artifacts**
   - COMPLETENESS_ASSESSMENT.md
   - GAP_ANALYSIS.md
   - COVERAGE_REPORT.md
   - NEXT_STEPS.md
   - metadata.json

### Required Output Files

**IMPORTANT**: Create these files in `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/completeness-assessment/iteration-4/` (Use this ABSOLUTE path - do NOT use relative paths):

#### 1. COMPLETENESS_ASSESSMENT.md

- Executive summary (completion %, status)
- Requirements coverage matrix
- Implementation quality assessment
- Documentation completeness score
- Test coverage analysis
- Overall rating (COMPLETE/INCOMPLETE/READY_FOR_RELEASE)
- Detailed recommendations

#### 2. GAP_ANALYSIS.md

- Comprehensive list of missing requirements
- Partial implementations requiring completion
- Documentation gaps
- Test coverage gaps
- Priority ranking (CRITICAL, HIGH, MEDIUM, LOW)
- For each gap:
  - Gap ID (GAP-001, GAP-002, etc.)
  - Description
  - Impact on completeness
  - Recommended action
  - Estimated effort

#### 3. COVERAGE_REPORT.md

- Requirement-by-requirement mapping table
- Implementation status for each requirement (COMPLETE/PARTIAL/MISSING)
- Evidence/artifacts for completed requirements (file paths, line numbers)
- Percentage completion per requirement category
- Visual coverage matrix (use markdown tables)

#### 4. NEXT_STEPS.md

- Prioritized action items to reach 100% completion
- Estimated effort for remaining work (hours/days)
- Risk assessment for incomplete items
- Recommended implementation order
- Success criteria for each action item
- Suggested timeline/roadmap

#### 5. metadata.json

Structured JSON with assessment metrics:
```json
{
  "assessment_date": "ISO timestamp",
  "primary_issue": 1,
  "secondary_issues": [],
  "reference_documents": ["/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa/iteration-1","/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/dev/iteration-4","/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/arch/iteration-5","/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-dev/iteration-3","/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-review/iteration-3"],
  "analysis_scope": "code_and_docs",
  "latest_iteration": 4,
  "overall_completion_percentage": 0,
  "requirements_coverage": {
    "total_requirements": 0,
    "implemented": 0,
    "partial": 0,
    "missing": 0
  },
  "quality_scores": {
    "code_quality": 0,
    "documentation_quality": 0,
    "test_coverage": 0
  },
  "status": "COMPLETE|INCOMPLETE|READY_FOR_RELEASE",
  "gaps": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "recommended_action": "RELEASE|CONTINUE_DEVELOPMENT|MAJOR_REVISIONS_NEEDED"
}
```

### Critical Rules

1. ✅ ALWAYS read ALL reference documents completely
2. ✅ ALWAYS examine actual implementation (if scope includes code)
3. ✅ ALWAYS provide specific evidence (file paths, line numbers)
4. ✅ ALWAYS calculate objective metrics and percentages
5. ✅ ALWAYS prioritize gaps by business impact
6. ✅ ALWAYS provide actionable, specific recommendations
7. ✅ ALWAYS save files to `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/completeness-assessment/iteration-4/` (ABSOLUTE PATH)
8. ❌ NEVER make assumptions without evidence
9. ❌ NEVER give generic advice - be specific
10. ❌ NEVER ignore edge cases or non-functional requirements

**Now begin your comprehensive completeness assessment.**
