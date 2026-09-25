import pandas as pd
import xlsxwriter
import os
from scipy.stats import wilcoxon

def create_excel():
    base_dir = '/home/pugario/Projects/horizon/backend/benchmark/results/v3'
    single_csv = os.path.join(base_dir, 'single', 'result.csv')
    multi_csv = os.path.join(base_dir, 'multi', 'result.csv')
    
    df_single = pd.read_csv(single_csv)
    df_multi = pd.read_csv(multi_csv)
    
    excel_path = os.path.join(base_dir, 'benchmark_manual.xlsx')
    
    workbook = xlsxwriter.Workbook(excel_path)
    
    def write_df_to_sheet(worksheet, df):
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value)
        for row_num, row_data in enumerate(df.values):
            for col_num, value in enumerate(row_data):
                if pd.isna(value):
                    worksheet.write(row_num + 1, col_num, "")
                elif isinstance(value, bool) or str(value) in ['True', 'False']:
                    worksheet.write(row_num + 1, col_num, str(value))
                else:
                    worksheet.write(row_num + 1, col_num, value)
                    
    # Write Data_Single
    worksheet_single = workbook.add_worksheet('Data_Single')
    write_df_to_sheet(worksheet_single, df_single)
                
    # Write Data_Multi
    worksheet_multi = workbook.add_worksheet('Data_Multi')
    write_df_to_sheet(worksheet_multi, df_multi)
                
    # Computations Sheet
    worksheet_comp = workbook.add_worksheet('Computations')
    
    bold = workbook.add_format({'bold': True})
    percent_fmt = workbook.add_format({'num_format': '0.0%'})
    num_fmt = workbook.add_format({'num_format': '0.00'})
    int_fmt = workbook.add_format({'num_format': '0'})
    pval_fmt = workbook.add_format({'num_format': '0.00E+00'})
    
    worksheet_comp.set_column('A:A', 25)
    worksheet_comp.set_column('B:C', 15)
    
    r = 0
    # --- Table 1: Overall CSR ---
    worksheet_comp.write(r, 0, 'Table 1: Overall CSR', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single', bold)
    worksheet_comp.write(r, 2, 'Multi', bold)
    
    # Calculate values
    def parse_bool(v):
        return str(v) == 'True' or v is True
        
    s_csr_comp = sum(parse_bool(x) for x in df_single['csr_pass'])
    m_csr_comp = sum(parse_bool(x) for x in df_multi['csr_pass'])
    s_tot = len(df_single)
    m_tot = len(df_multi)
    
    r += 1
    worksheet_comp.write(r, 0, 'CSR (%)')
    worksheet_comp.write_formula(r, 1, '=B5/B6', percent_fmt, s_csr_comp/s_tot if s_tot else 0)
    worksheet_comp.write_formula(r, 2, '=C5/C6', percent_fmt, m_csr_comp/m_tot if m_tot else 0)
    r += 1
    worksheet_comp.write(r, 0, 'Compiled')
    worksheet_comp.write_formula(r, 1, '=COUNTIF(Data_Single!Z:Z, "True")', int_fmt, s_csr_comp)
    worksheet_comp.write_formula(r, 2, '=COUNTIF(Data_Multi!Z:Z, "True")', int_fmt, m_csr_comp)
    r += 1
    worksheet_comp.write(r, 0, 'Total')
    worksheet_comp.write_formula(r, 1, '=COUNTA(Data_Single!A:A)-1', int_fmt, s_tot)
    worksheet_comp.write_formula(r, 2, '=COUNTA(Data_Multi!A:A)-1', int_fmt, m_tot)
    
    r += 3
    # --- Table 2: Duration Statistics ---
    worksheet_comp.write(r, 0, 'Table 2: Duration Statistics', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single (7B)', bold)
    worksheet_comp.write(r, 2, 'Multi (3BxN)', bold)
    
    s_dur = pd.to_numeric(df_single['duration_ms'], errors='coerce') / 1000
    m_dur = pd.to_numeric(df_multi['duration_ms'], errors='coerce') / 1000
    s_dur_succ = pd.to_numeric(df_single[df_single['exit_status']=='SUCCESS']['duration_ms'], errors='coerce') / 1000
    m_dur_succ = pd.to_numeric(df_multi[df_multi['exit_status']=='SUCCESS']['duration_ms'], errors='coerce') / 1000

    r += 1
    worksheet_comp.write(r, 0, 'RAW mean (s)')
    worksheet_comp.write_formula(r, 1, '=AVERAGE(Data_Single!N:N)/1000', num_fmt, s_dur.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGE(Data_Multi!N:N)/1000', num_fmt, m_dur.mean())
    
    r += 1
    worksheet_comp.write(r, 0, 'RAW median (s)')
    worksheet_comp.write_formula(r, 1, '=MEDIAN(Data_Single!N:N)/1000', num_fmt, s_dur.median())
    worksheet_comp.write_formula(r, 2, '=MEDIAN(Data_Multi!N:N)/1000', num_fmt, m_dur.median())
    
    r += 1
    worksheet_comp.write(r, 0, 'SUCCESS mean (s)')
    worksheet_comp.write_formula(r, 1, '=AVERAGEIFS(Data_Single!N:N, Data_Single!D:D, "SUCCESS")/1000', num_fmt, s_dur_succ.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGEIFS(Data_Multi!N:N, Data_Multi!D:D, "SUCCESS")/1000', num_fmt, m_dur_succ.mean())
    
    r += 1
    worksheet_comp.write(r, 0, 'Total wall time (s)')
    worksheet_comp.write_formula(r, 1, '=SUM(Data_Single!N:N)/1000', int_fmt, s_dur.sum())
    worksheet_comp.write_formula(r, 2, '=SUM(Data_Multi!N:N)/1000', int_fmt, m_dur.sum())
    
    r += 3
    # --- Table 3: Peak GPU Memory ---
    worksheet_comp.write(r, 0, 'Table 3: Peak GPU Memory', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single (7B)', bold)
    worksheet_comp.write(r, 2, 'Multi (3BxN)', bold)
    
    s_gpu = pd.to_numeric(df_single['gpu_peak_mb'], errors='coerce')
    m_gpu = pd.to_numeric(df_multi['gpu_peak_mb'], errors='coerce')

    r += 1
    worksheet_comp.write(r, 0, 'Mean (MB)')
    worksheet_comp.write_formula(r, 1, '=AVERAGE(Data_Single!R:R)', int_fmt, s_gpu.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGE(Data_Multi!R:R)', int_fmt, m_gpu.mean())
    r += 1
    worksheet_comp.write(r, 0, 'Median (MB)')
    worksheet_comp.write_formula(r, 1, '=MEDIAN(Data_Single!R:R)', int_fmt, s_gpu.median())
    worksheet_comp.write_formula(r, 2, '=MEDIAN(Data_Multi!R:R)', int_fmt, m_gpu.median())
    r += 1
    worksheet_comp.write(r, 0, 'Max (MB)')
    worksheet_comp.write_formula(r, 1, '=MAX(Data_Single!R:R)', int_fmt, s_gpu.max())
    worksheet_comp.write_formula(r, 2, '=MAX(Data_Multi!R:R)', int_fmt, m_gpu.max())
    r += 1
    worksheet_comp.write(r, 0, 'Min (MB)')
    worksheet_comp.write_formula(r, 1, '=MIN(Data_Single!R:R)', int_fmt, s_gpu.min())
    worksheet_comp.write_formula(r, 2, '=MIN(Data_Multi!R:R)', int_fmt, m_gpu.min())
    
    r += 3
    # --- Table 4: CC Delta ---
    worksheet_comp.write(r, 0, 'Table 4: CC Delta', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single', bold)
    worksheet_comp.write(r, 2, 'Multi', bold)
    
    s_cc = pd.to_numeric(df_single['cc_delta'], errors='coerce')
    m_cc = pd.to_numeric(df_multi['cc_delta'], errors='coerce')

    r += 1
    worksheet_comp.write(r, 0, 'Mean')
    worksheet_comp.write_formula(r, 1, '=AVERAGE(Data_Single!J:J)', num_fmt, s_cc.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGE(Data_Multi!J:J)', num_fmt, m_cc.mean())
    r += 1
    worksheet_comp.write(r, 0, 'Median')
    worksheet_comp.write_formula(r, 1, '=MEDIAN(Data_Single!J:J)', num_fmt, s_cc.median())
    worksheet_comp.write_formula(r, 2, '=MEDIAN(Data_Multi!J:J)', num_fmt, m_cc.median())
    r += 1
    worksheet_comp.write(r, 0, 'Max')
    worksheet_comp.write_formula(r, 1, '=MAX(Data_Single!J:J)', num_fmt, s_cc.max())
    worksheet_comp.write_formula(r, 2, '=MAX(Data_Multi!J:J)', num_fmt, m_cc.max())
    r += 1
    worksheet_comp.write(r, 0, 'Min')
    worksheet_comp.write_formula(r, 1, '=MIN(Data_Single!J:J)', num_fmt, s_cc.min())
    worksheet_comp.write_formula(r, 2, '=MIN(Data_Multi!J:J)', num_fmt, m_cc.min())
    
    r += 3
    # --- Table 5: MI Delta ---
    worksheet_comp.write(r, 0, 'Table 5: MI Delta', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single', bold)
    worksheet_comp.write(r, 2, 'Multi', bold)
    
    s_mi = pd.to_numeric(df_single['mi_delta'], errors='coerce')
    m_mi = pd.to_numeric(df_multi['mi_delta'], errors='coerce')

    r += 1
    worksheet_comp.write(r, 0, 'Mean')
    worksheet_comp.write_formula(r, 1, '=AVERAGE(Data_Single!M:M)', num_fmt, s_mi.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGE(Data_Multi!M:M)', num_fmt, m_mi.mean())
    r += 1
    worksheet_comp.write(r, 0, 'Median')
    worksheet_comp.write_formula(r, 1, '=MEDIAN(Data_Single!M:M)', num_fmt, s_mi.median())
    worksheet_comp.write_formula(r, 2, '=MEDIAN(Data_Multi!M:M)', num_fmt, m_mi.median())
    r += 1
    worksheet_comp.write(r, 0, 'Max')
    worksheet_comp.write_formula(r, 1, '=MAX(Data_Single!M:M)', num_fmt, s_mi.max())
    worksheet_comp.write_formula(r, 2, '=MAX(Data_Multi!M:M)', num_fmt, m_mi.max())
    r += 1
    worksheet_comp.write(r, 0, 'Min')
    worksheet_comp.write_formula(r, 1, '=MIN(Data_Single!M:M)', num_fmt, s_mi.min())
    worksheet_comp.write_formula(r, 2, '=MIN(Data_Multi!M:M)', num_fmt, m_mi.min())

    r += 3
    # --- Table 6: BER ---
    worksheet_comp.write(r, 0, 'Table 6: BER', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Single', bold)
    worksheet_comp.write(r, 2, 'Multi', bold)
    
    s_ber = pd.to_numeric(df_single['ber'], errors='coerce')
    m_ber = pd.to_numeric(df_multi['ber'], errors='coerce')

    r += 1
    worksheet_comp.write(r, 0, 'Mean')
    worksheet_comp.write_formula(r, 1, '=AVERAGE(Data_Single!AA:AA)', percent_fmt, s_ber.mean())
    worksheet_comp.write_formula(r, 2, '=AVERAGE(Data_Multi!AA:AA)', percent_fmt, m_ber.mean())
    r += 1
    worksheet_comp.write(r, 0, 'Median')
    worksheet_comp.write_formula(r, 1, '=MEDIAN(Data_Single!AA:AA)', percent_fmt, s_ber.median())
    worksheet_comp.write_formula(r, 2, '=MEDIAN(Data_Multi!AA:AA)', percent_fmt, m_ber.median())
    r += 1
    worksheet_comp.write(r, 0, 'Max')
    worksheet_comp.write_formula(r, 1, '=MAX(Data_Single!AA:AA)', percent_fmt, s_ber.max())
    worksheet_comp.write_formula(r, 2, '=MAX(Data_Multi!AA:AA)', percent_fmt, m_ber.max())
    r += 1
    worksheet_comp.write(r, 0, 'Min')
    worksheet_comp.write_formula(r, 1, '=MIN(Data_Single!AA:AA)', percent_fmt, s_ber.min())
    worksheet_comp.write_formula(r, 2, '=MIN(Data_Multi!AA:AA)', percent_fmt, m_ber.min())

    r += 3
    from scipy.stats import shapiro
    
    # Calculate Wilcoxon and Shapiro tests in python
    paired = pd.merge(df_single, df_multi, on='num', suffixes=('_s', '_m'))
    
    def get_stats(col_s, col_m):
        vals_s = pd.to_numeric(paired[col_s], errors='coerce').fillna(0)
        vals_m = pd.to_numeric(paired[col_m], errors='coerce').fillna(0)
        diff = vals_m - vals_s
        diff = diff[diff != 0]
        if len(diff) >= 3:
            try:
                _, p_shap = shapiro(diff)
                _, p_wilc = wilcoxon(diff)
                return p_shap, p_wilc
            except:
                pass
        return 1.0, 1.0
        
    s_dur, w_dur = get_stats('duration_ms_s', 'duration_ms_m')
    s_gpu, w_gpu = get_stats('gpu_peak_mb_s', 'gpu_peak_mb_m')
    s_cc, w_cc = get_stats('cc_delta_s', 'cc_delta_m')
    s_mi, w_mi = get_stats('mi_delta_s', 'mi_delta_m')
    s_ber, w_ber = get_stats('ber_s', 'ber_m')
    
    def decision(p):
        return "Significant" if p < 0.05 else "Not Significant"

    # --- Table 7: Statistical Significance ---
    worksheet_comp.write(r, 0, 'Table 7: Statistical Significance', bold)
    r += 1
    worksheet_comp.write(r, 0, 'Metric', bold)
    worksheet_comp.write(r, 1, 'Shapiro-Wilk p-value', bold)
    worksheet_comp.write(r, 2, 'Wilcoxon p-value', bold)
    worksheet_comp.write(r, 3, 'Significant (p < 0.05)?', bold)
    
    worksheet_comp.set_column('C:D', 20)
    
    def write_stats_row(row_idx, metric_name, shap, wilc):
        worksheet_comp.write(row_idx, 0, metric_name)
        worksheet_comp.write(row_idx, 1, shap, pval_fmt)
        worksheet_comp.write(row_idx, 2, wilc, pval_fmt)
        worksheet_comp.write_formula(row_idx, 3, f'=IF(C{row_idx+1}<0.05, "Significant", "Not Significant")', None, decision(wilc))

    r += 1
    write_stats_row(r, 'Duration (RAW)', s_dur, w_dur)
    r += 1
    write_stats_row(r, 'GPU Memory (RAW)', s_gpu, w_gpu)
    r += 1
    write_stats_row(r, 'CC Delta (RAW)', s_cc, w_cc)
    r += 1
    write_stats_row(r, 'MI Delta (RAW)', s_mi, w_mi)
    r += 1
    write_stats_row(r, 'BER (RAW)', s_ber, w_ber)

    workbook.close()
    print(f'Excel file generated at {excel_path}')

if __name__ == '__main__':
    create_excel()
