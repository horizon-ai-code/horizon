const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, TableOfContents
} = require("docx");

const A4_W = 11906, A4_H = 16838, MARGIN = 1440;
const sectionProps = {
  page: { size: { width: A4_W, height: A4_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
};
const hf = {
  headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Horizon \u2014 Verified Test Cases", font: "Arial", size: 18, color: "999999" })] })] }) },
  footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Arial", size: 18, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "999999" })] })] }) },
};

const ENTRIES = {
  Simple: [
    { num:"68", intent:"DECOMPOSE_CONDITIONAL", instruction:"Decompose the compound condition `x == 0 || x == 1` in the mySqrt method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.",
      code:`public class Solution {
    public int mySqrt(int x) {
        if (x == 0 || x == 1) return x;
        int start = 1, end = x, ans = 0;
        while (start <= end) {
            int mid = (start + end) / 2;
            if (mid * mid == x) return mid;
            if (mid <= x / mid) {
                start = mid + 1;
                ans = mid;
            } else {
                end = mid - 1;
            }
        }
        return ans;
    }
}` },
    { num:"110", intent:"EXTRACT_METHOD", instruction:"Extract the core logic in the minDepth method into a private helper method called computeMinDepth. The helper should encapsulate the main algorithmic work. Call computeMinDepth from minDepth and pass the necessary parameters. Return the computed result from the helper.",
      code:`public class Solution {
    public int minDepth(TreeNode root) {
        if (root == null) return 0;
        int left = minDepth(root.left);
        int right = minDepth(root.right);
        return (left == 0 || right == 0) ? left + right + 1 : Math.min(left, right) + 1;
    }
}` },
    { num:"144", intent:"RENAME_SYMBOL", instruction:"Rename val to value throughout the entire postorderTraversal method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.",
      code:`import java.util.ArrayList;
import java.util.List;
import java.util.Stack;

public class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int x) { val = x; }
}

public class Solution {
    public List<Integer> postorderTraversal(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        Stack<TreeNode> s = new Stack<>();
        if (root == null) return result;
        s.push(root);
        while (!s.isEmpty()) {
            TreeNode current = s.pop();
            result.add(0, current.val);
            if (current.left != null) s.push(current.left);
            if (current.right != null) s.push(current.right);
        }
        return result;
    }
}` },
    { num:"442", intent:"REMOVE_CONTROL_FLAG", instruction:"Remove the boolean flag variable in the canConstruct method. Instead of setting the flag when the target is found and checking it after the loop, use an early return directly at the point where the condition is met.",
      code:`public class Solution {
    public boolean canConstruct(String s) {
        int n = s.length();
        for (int i = n / 2; i > 0; --i) {
            if (n % i == 0) {
                String substr = s.substring(0, i);
                boolean flag = true;
                for (int j = i; j < n; j += i) {
                    if (!s.substring(j, j + i).equals(substr)) {
                        flag = false;
                        break;
                    }
                }
                if (flag) return true;
            }
        }
        return false;
    }
}` },
    { num:"2272", intent:"EXTRACT_CONSTANT", instruction:"Extract the magic number 1000000000 in the boxCategory method into a named constant at the class level as a static final field. Replace every occurrence of 1000000000 with the new constant name.",
      code:`public class Solution {
    public String boxCategory(int length, int width, int height, int mass) {
        boolean bulky = length >= 10000 || width >= 10000 || height >= 10000 || (long)length * width * height >= 1000000000;
        boolean heavy = mass >= 100;
        if (bulky && heavy) return "Both ";
        if (bulky) return "Bulky ";
        if (heavy) return "Heavy ";
        return "Neither ";
    }
}` },
  ],
  Edge: [
    { num:"18", intent:"RENAME_SYMBOL", instruction:"Rename val to value throughout the entire removeNthFromEnd method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.",
      code:`public class ListNode {
    int val;
    ListNode next;
    ListNode(int x) { val = x; }
}

public class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode first = head;
        ListNode second = head;
        for (int i = 0; i < n; i++) first = first.next;
        if (first == null) { head = head.next; return head; }
        while (first.next != null) { first = first.next; second = second.next; }
        second.next = second.next.next;
        return head;
    }
}` },
    { num:"23", intent:"DECOMPOSE_CONDITIONAL", instruction:"Decompose the compound condition \`head == null || head.next == null\` in the swapPairs method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.",
      code:`public class Solution {
    public ListNode swapPairs(ListNode head) {
        if (head == null || head.next == null) return head;
        ListNode second = head.next;
        head.next = swapPairs(second.next);
        second.next = head;
        return second;
    }
}` },
    { num:"584", intent:"EXTRACT_CONSTANT", instruction:"Extract the magic number 1000000007 in the findDerangement method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.",
      code:`public class Solution {
    public int findDerangement(int n) {
        final int MOD = 1000000007;
        long[] dp = new long[n + 1];
        dp[2] = 1;
        for (int i = 3; i <= n; ++i) dp[i] = (i - 1) * (dp[i - 1] + dp[i - 2]) % MOD;
        return (int)dp[n];
    }
}` },
    { num:"305", intent:"SPLIT_LOOP", instruction:"Split the nested loop in the coinChange method into separate loops, each handling one distinct aspect of the computation. The current structure combines multiple responsibilities in a single nested loop, making the logic harder to follow.",
      code:`public class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int coin : coins)
            for (int i = coin; i <= amount; i++)
                dp[i] = Math.min(dp[i], dp[i - coin] + 1);
        return dp[amount] <= amount ? dp[amount] : -1;
    }
}` },
    { num:"2227", intent:"SPLIT_LOOP", instruction:"Split the nested loop in the findMinMax method into separate loops, each handling one distinct aspect of the computation. The current structure combines multiple responsibilities in a single nested loop, making the logic harder to follow.",
      code:`import java.util.*;
public class TreeNode {
    int val; TreeNode left, right;
    TreeNode() {} TreeNode(int v) { val = v; }
    TreeNode(int v, TreeNode l, TreeNode r) { val = v; left = l; right = r; }
}
public class Solution {
    public List<List<Integer>> findMinMax(TreeNode root, int[] queries) {
        if (root == null) return new ArrayList<>();
        List<List<Integer>> ans = new ArrayList<>();
        for (int q : queries) {
            TreeNode n = root;
            List<Integer> cur = Arrays.asList(-1, -1);
            while (n != null) {
                if (n.val < q) { cur.set(0, n.val); n = n.right; }
                else { cur.set(1, n.val); if (n.val == q) { cur.set(0, q); break; } n = n.left; }
            }
            ans.add(cur);
        }
        return ans;
    }
}` },
  ],
  Complex: [
    { num:"217", intent:"EXTRACT_METHOD", instruction:"Extract the core logic in the countDigitOne method into a private helper method called computeCountDigitOne. The helper should encapsulate the main algorithmic work. Call computeCountDigitOne from countDigitOne and pass the necessary parameters. Return the computed result from the helper.",
      code:`public class Solution {
    public int countDigitOne(int n) {
        int count = 0;
        for(long i = 1; i <= n; i *= 10) {
            long divider = i * 10;
            count += (n / divider) * i + Math.min(Math.max(n % divider - i + 1, 0), i);
        }
        return count;
    }
}` },
    { num:"610", intent:"EXTRACT_METHOD", instruction:"Extract the core logic in the newInteger method into a private helper method called computeNewInteger. The helper should encapsulate the main algorithmic work. Call computeNewInteger from newInteger and pass the necessary parameters. Return the computed result from the helper.",
      code:`public class Solution {
    public int newInteger(int n) {
        int result = 0, base = 1;
        while (n>0) { result += n % 9 * base; n /= 9; base *= 10; }
        return result;
    }
}` },
    { num:"1161", intent:"EXTRACT_CONSTANT", instruction:"Extract the magic number 1000000007 in the numberOfWays method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.",
      code:`public class Solution {
    public int numberOfWays(int numPeople) {
        int MOD = 1000000007;
        int[] dp = new int[numPeople / 2 + 1]; dp[0] = 1;
        for (int i = 1; i <= numPeople / 2; ++i)
            for (int j = 1; j <= i; ++j)
                dp[i] = (dp[i] + (int)(((long) dp[i - j] * dp[j - 1]) % MOD )) % MOD;
        return dp[numPeople / 2];
    }
}` },
    { num:"125", intent:"CONSOLIDATE_CONDITIONAL", instruction:"Consolidate the 5 separate loops in the findLadders method into a single pass. The current approach iterates over the same data structure multiple times. Merge the loop bodies to eliminate duplicate iteration and improve performance.",
      code:`import java.util.*;
public class Solution {
    public List<List<String>> findLadders(String beginWord, String endWord, List<String> wordList) {
        Set<String> dict = new HashSet<>(wordList);
        if (!dict.contains(endWord)) return Collections.emptyList();
        Map<String, List<String>> adjacent = new HashMap<>();
        Map<String, Integer> distance = new HashMap<>();
        Queue<String> queue = new LinkedList<>();
        queue.offer(beginWord); distance.put(beginWord, 0);
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (current.equals(endWord)) break;
            for (String neighbor : neighbors(current)) {
                if (!dict.contains(neighbor)) continue;
                if (!distance.containsKey(neighbor)) {
                    distance.put(neighbor, distance.get(current) + 1); queue.offer(neighbor);
                }
                if (distance.get(neighbor).equals(distance.get(current) + 1))
                    adjacent.computeIfAbsent(current, k -> new ArrayList<>()).add(neighbor);
            }
        }
        List<List<String>> result = new ArrayList<>();
        List<String> path = new ArrayList<>(); path.add(beginWord);
        backtrack(beginWord, endWord, path, adjacent, result);
        return result;
    }
    private void backtrack(String cur, String end, List<String> path, Map<String, List<String>> adj, List<List<String>> res) {
        if (cur.equals(end)) { res.add(new ArrayList<>(path)); return; }
        for (String nxt : adj.getOrDefault(cur, Collections.emptyList())) { path.add(nxt); backtrack(nxt, end, path, adj, res); path.remove(path.size() - 1); }
    }
    private List<String> neighbors(String word) {
        List<String> res = new ArrayList<>(); char[] chars = word.toCharArray();
        for (int i = 0; i < chars.length; i++) { char o = chars[i]; for (char j = 'a'; j <= 'z'; j++) { if (j == o) continue; chars[i] = j; res.add(new String(chars)); } chars[i] = o; }
        return res;
    }
}` },
    { num:"131", intent:"DECOMPOSE_CONDITIONAL", instruction:"Decompose the compound condition \`s.charAt(i) == s.charAt(j) && (j - i < 2 || isPalindrome[i + 1][j - 1])\` in the minCut method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.",
      code:`public class Solution {
    public int minCut(String s) {
        int n = s.length();
        int[] dp = new int[n + 1];
        boolean[][] isPalindrome = new boolean[n][n];
        for (int i=0; i <= n; i++) dp[i] = i - 1;
        for (int j=1; j < n; j++)
            for (int i=j; i >= 0; i--)
                if (s.charAt(i) == s.charAt(j) && (j - i < 2 || isPalindrome[i + 1][j - 1])) {
                    isPalindrome[i][j] = true;
                    dp[j + 1] = Math.min(dp[j + 1], dp[i] + 1);
                }
        return dp[n];
    }
}` },
  ],
};

const CAT_COLORS = { Simple: "2E7D32", Edge: "EF6C00", Complex: "C62828" };

function codePara(line) {
  return new Paragraph({
    spacing: { after: 0, line: 250 },
    children: [new TextRun({ text: line || " ", font: "Consolas", size: 15, color: "333333" })]
  });
}

function entrySection(cat, e) {
  const color = CAT_COLORS[cat];
  const badge = new TextRun({ text: `  ${cat.toUpperCase()}  `, font: "Arial", size: 18, bold: true, color: "FFFFFF", shading: { fill: color, type: ShadingType.CLEAR } });
  return [
    new Paragraph({ children: [badge] }),
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text: `#${e.num} — ${e.intent}`, font: "Arial", size: 26, bold: true, color: color })]
    }),
    new Paragraph({
      spacing: { after: 160 },
      indent: { left: 240 },
      border: { left: { style: BorderStyle.SINGLE, size: 6, color, space: 8 } },
      children: [new TextRun({ text: e.instruction, font: "Arial", size: 21, italics: true })]
    }),
    new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: "Source Code", font: "Arial", size: 20, bold: true, color: "555555" })] }),
    ...e.code.split("\n").map(codePara),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({ text: "Expected: ", font: "Arial", size: 20, bold: true, color: "555555" }),
        new TextRun({ text: "  SUCCESS  ", font: "Arial", size: 20, bold: true, color: "FFFFFF", shading: { fill: "2E7D32", type: ShadingType.CLEAR } }),
        new TextRun({ text: "  (verified)", font: "Arial", size: 18, color: "888888" }),
      ]
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function catHeading(cat) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: cat, font: "Arial", size: 36, bold: true, color: CAT_COLORS[cat] })]
  });
}

const titleChildren = [
  new Paragraph({ spacing: { before: 4000 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Horizon Benchmark", font: "Arial", size: 52, bold: true, color: "2B579A" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Verified Test Cases", font: "Arial", size: 40, color: "444444" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "15 entries — 5 per category, all confirmed MATCH + SUCCESS", font: "Arial", size: 24, color: "666666" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "AI-Driven Java Refactoring Pipeline", font: "Arial", size: 22, color: "888888" })] }),
];

const tocChildren = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Table of Contents", font: "Arial", size: 32, bold: true })] }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-1" }),
];

const contentChildren = [];
for (const cat of ["Simple", "Edge", "Complex"]) {
  contentChildren.push(catHeading(cat));
  for (const e of ENTRIES[cat]) contentChildren.push(...entrySection(cat, e));
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
    ]
  },
  sections: [
    { properties: sectionProps, children: titleChildren },
    { properties: sectionProps, ...hf, children: tocChildren },
    { properties: sectionProps, ...hf, children: contentChildren },
  ]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/pugario/Projects/horizon/docs/test/horizon-verified-test-cases.docx", buf);
  console.log("OK");
});
