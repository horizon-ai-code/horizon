import pandas as pd
import numpy as np

multi_path = '/home/pugario/Projects/horizon/backend/benchmark/results/v3/multi/result.csv'
single_path = '/home/pugario/Projects/horizon/backend/benchmark/results/v3/single/result.csv'

df_multi = pd.read_csv(multi_path)
df_single = pd.read_csv(single_path)

# Cleanup BER (contains '-')
df_multi['ber'] = pd.to_numeric(df_multi['ber'], errors='coerce')
df_single['ber'] = pd.to_numeric(df_single['ber'], errors='coerce')
df_multi['csr_pass'] = df_multi['csr_pass'].astype(str) == 'True'
df_single['csr_pass'] = df_single['csr_pass'].astype(str) == 'True'

# Sheet 3: Comparison_Math
df_merged = pd.merge(df_multi, df_single, on=['num', 'difficulty', 'intent'], suffixes=('_multi', '_single'))

comp_cols = [
    'num', 'difficulty', 'intent', 
    'status_multi', 'status_single',
    'duration_ms_multi', 'duration_ms_single',
    'gpu_peak_mb_multi', 'gpu_peak_mb_single',
    'cc_delta_multi', 'cc_delta_single',
    'mi_delta_multi', 'mi_delta_single',
    'ber_multi', 'ber_single',
    'csr_pass_multi', 'csr_pass_single',
    'strategy_iter_multi', 'syntax_iter_multi'
]

df_comp = df_merged[comp_cols].copy()
df_comp['duration_diff (M-S)'] = df_comp['duration_ms_multi'] - df_comp['duration_ms_single']
df_comp['cc_diff (M-S)'] = df_comp['cc_delta_multi'] - df_comp['cc_delta_single']
df_comp['mi_diff (M-S)'] = df_comp['mi_delta_multi'] - df_comp['mi_delta_single']

# Sheet 4: Aggregation_Summary
metrics_data = []

# Overall Pass Rate
pass_m = (df_multi['status'] == 'PASS').mean() * 100
pass_s = (df_single['status'] == 'PASS').mean() * 100
metrics_data.append(('Overall Pass Rate (%)', pass_m, pass_s))

# Iterative Resolution Rate (Multi Only)
flagged_mask = df_multi['phase4_pass'].astype(str) == 'False'
flagged_count = flagged_mask.sum()
if flagged_count > 0:
    resolved_count = ((flagged_mask) & (df_multi['status'] == 'PASS')).sum()
    iter_res_m = (resolved_count / flagged_count) * 100
else:
    iter_res_m = np.nan
metrics_data.append(('Iterative Resolution Rate (%)', iter_res_m, 'N/A'))

# CSR
csr_m = df_multi['csr_pass'].mean() * 100
csr_s = df_single['csr_pass'].mean() * 100
metrics_data.append(('Compile Success Rate (%)', csr_m, csr_s))

# BER
ber_m = df_multi['ber'].mean()
ber_s = df_single['ber'].mean()
metrics_data.append(('Behavioral Equivalence Rate (Avg)', ber_m, ber_s))

# Duration
dur_m = df_multi['duration_ms'].mean()
dur_s = df_single['duration_ms'].mean()
metrics_data.append(('Avg Duration (ms)', dur_m, dur_s))

# GPU
gpu_m = df_multi['gpu_peak_mb'].mean()
gpu_s = df_single['gpu_peak_mb'].mean()
metrics_data.append(('Avg GPU Peak (MB)', gpu_m, gpu_s))

# CC
cc_m = df_multi['cc_delta'].mean()
cc_s = df_single['cc_delta'].mean()
metrics_data.append(('Avg CC Delta', cc_m, cc_s))

# MI
mi_m = df_multi['mi_delta'].mean()
mi_s = df_single['mi_delta'].mean()
metrics_data.append(('Avg MI Delta', mi_m, mi_s))

df_agg_main = pd.DataFrame(metrics_data, columns=['Metric', 'Multi', 'Single'])

# Difficulty breakdowns
diff_m = df_multi.groupby('difficulty').agg({
    'status': lambda x: (x == 'PASS').mean() * 100,
    'duration_ms': 'mean'
}).rename(columns={'status': 'Pass_Rate_Multi', 'duration_ms': 'Dur_Multi'})

diff_s = df_single.groupby('difficulty').agg({
    'status': lambda x: (x == 'PASS').mean() * 100,
    'duration_ms': 'mean'
}).rename(columns={'status': 'Pass_Rate_Single', 'duration_ms': 'Dur_Single'})

df_diff = pd.concat([diff_m, diff_s], axis=1)

out_path = '/home/pugario/Projects/horizon/benchmark_defense.xlsx'
with pd.ExcelWriter(out_path, engine='openpyxl') as writer:
    df_multi.to_excel(writer, sheet_name='Raw_Multi', index=False)
    df_single.to_excel(writer, sheet_name='Raw_Single', index=False)
    df_comp.to_excel(writer, sheet_name='Comparison_Math', index=False)
    df_agg_main.to_excel(writer, sheet_name='Aggregation_Summary', index=False, startrow=0)
    df_diff.to_excel(writer, sheet_name='Aggregation_Summary', startrow=10)

print(f"Saved excel to {out_path}")
