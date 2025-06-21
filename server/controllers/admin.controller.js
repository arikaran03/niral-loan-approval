import Loan from '../database/models/LoanModel.js';
import LoanSubmission from '../database/models/LoanSubmissionModel.js';
import User from '../database/models/UserModel.js';

export async function getDashboardStats(req, res) {
  try {
    const totalLoans = await Loan.countDocuments();
    const totalSubmissions = await LoanSubmission.countDocuments();
    const totalUsers = await User.countDocuments({ 
      type: { $in: ['applicant', 'user'] } 
    });

    // Submissions by stage
    const byStage = await LoanSubmission.aggregate([
      { $group: { _id: "$stage", count: { $sum: 1 } } }
    ]);

    // Submissions by loan scheme
    const submissionsByLoan = await LoanSubmission.aggregate([
      {
        $group: {
          _id: "$loan_id",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "loans", // The name of the Loan collection
          localField: "_id",
          foreignField: "_id",
          as: "loan",
        },
      },
      {
        $unwind: "$loan", // Deconstruct the loan array
      },
      {
        $project: {
          _id: 0,
          loanTitle: "$loan.title",
          count: 1,
        },
      },
    ]);

    // Average amount requested
    const averageAmount = await LoanSubmission.aggregate([
      {
        $group: {
          _id: null,
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    // **NEW**: Submissions over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissionsOverTime = await LoanSubmission.aggregate([
        {
            $match: {
                created_at: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 } // Sort by date ascending
        },
        {
            $project: {
                date: "$_id",
                count: 1,
                _id: 0
            }
        }
    ]);


    // Recent Submissions (last 5, for example)
    const recentSubmissions = await LoanSubmission.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate('user_id', 'name') // Populate user name
      .populate('loan_id', 'title')
      .select('loan_id user_id created_at stage amount');

    return res.json({
      totalLoans,
      totalSubmissions,
      totalUsers,
      submissionsByStage: byStage.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      submissionsByLoan,
      averageAmount: averageAmount.length > 0 ? averageAmount[0].avgAmount : 0,
      submissionsOverTime, // <-- Replaced loansByType
      recentSubmissions
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Failed to load dashboard stats" });
  }
}