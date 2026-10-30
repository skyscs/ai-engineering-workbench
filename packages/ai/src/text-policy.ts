// Candidate text-only policy. Qualification is separate from the Workbench adapter.
export const textPolicyVersion = 'text-only-v1';
export const textCliVersion = 'codex-cli 0.159.2';
export const textDisabledFeatures = ['apps', 'plugins', 'hooks', 'browser_use', 'computer_use', 'image_generation',
  'multi_agent', 'multi_agent_v2', 'shell_tool', 'view_image', 'skill_search', 'shell_snapshot',
  'workspace_dependencies', 'unbounded_connection_retries', 'enable_request_compression', 'goals', 'sleep_tool', 'in_app_updates'];
export const textRestrictionArgs = ['-c', 'agents.enabled=false', '-c', 'project_root_markers=[]',
  '-c', 'project_doc_max_bytes=0', '-c', 'features.skip_host_skill_discovery=true', '-c', 'skills.max_context_tokens=1',
  '-c', 'web_search="disabled"', '-c', 'notify=[]', '-c', 'analytics.enabled=false', '-c', 'suppress_unstable_features_warning=true',
  ...textDisabledFeatures.flatMap(feature => ['--disable', feature])];
